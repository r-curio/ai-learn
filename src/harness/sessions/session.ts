import { Agent, type AgentEvent } from "@earendil-works/pi-agent-core";
import type { AssistantMessage, Message } from "@earendil-works/pi-ai";
import { randomUUID } from "node:crypto";
import { rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
	chatTypeOf,
	type ChatType,
	type OpenPage,
	type RunEvent,
	type SessionSummary,
	type SessionView,
	type UsageSummary,
} from "../../shared/protocol.ts";
import { AttachmentStore } from "../attachments.ts";
import type { Engine, ResolvedModel } from "../engine.ts";
import { LOG_VERSION, LogWriter, readLog, toStored, type LogEntry, type LogHeader } from "./log.ts";
import {
	interruptedToolResult,
	isFailedReply,
	messagesFromLog,
	unresolvedToolCalls,
} from "./recovery.ts";
import { createTools, toolLabels } from "../tools.ts";
import { SYSTEM_PROMPT, viewingTag } from "./tutor-prompt.ts";
import {
	addUsage,
	buildTranscript,
	contextOf,
	markInterrupted,
	titleOf,
	usageOf,
	searchTextOf,
} from "./transcript.ts";

export class SessionBusyError extends Error {
	constructor() {
		super("This session is already responding.");
	}
}

export class SessionStateError extends Error {}

const emptyUsage = (): UsageSummary => ({ inputTokens: 0, outputTokens: 0, costUsd: 0 });

interface Restored {
	id: string;
	entries: LogEntry[];
	messages: Message[];
	attachments: AttachmentStore;
}

/** One conversation: a Pi agent, its uploads, and the append-only log it can be rebuilt from. */
export class Session {
	readonly id: string;
	readonly attachments: AttachmentStore;
	/** Called after each saved summary, so the session index can stay current. */
	onSummary?: (summary: SessionSummary) => void;
	private readonly engine: Engine;
	private readonly dir: string;
	private readonly log: LogWriter;
	private readonly agent: Agent;
	private readonly entries: LogEntry[];
	private readonly usage: UsageSummary;
	private readonly systemPrompt: string;
	private chatType: ChatType;
	private running = false;

	constructor(engine: Engine, dataDir: string, restored?: Restored) {
		this.engine = engine;
		this.id = restored?.id ?? randomUUID();
		this.dir = join(dataDir, "sessions", this.id);
		this.attachments = restored?.attachments ?? new AttachmentStore(join(this.dir, "attachments"));
		this.log = new LogWriter(join(this.dir, "session.jsonl"));
		this.entries = restored?.entries ?? [];
		this.usage = usageOf(this.entries);
		const header = this.entries[0] as LogHeader | undefined;
		// A session keeps the prompt it started with, so old history replays exactly.
		this.systemPrompt = header?.systemPrompt ?? SYSTEM_PROMPT;
		this.chatType = chatTypeOf(header?.chatType);
		this.agent = new Agent({
			initialState: {
				systemPrompt: this.systemPrompt,
				tools: createTools(this.attachments),
				messages: restored?.messages ?? [],
			},
			streamFn: engine.streamFn,
			sessionId: this.id,
			identity: { attribution: { name: "ai-learn", url: "https://github.com/r-curio/ai-learn" } },
		});
	}

	/** Rebuild a session from disk and settle anything a crash left unfinished. */
	static async load(engine: Engine, dataDir: string, id: string): Promise<Session> {
		const dir = join(dataDir, "sessions", id);
		const entries = await readLog(join(dir, "session.jsonl"));
		const attachments = new AttachmentStore(join(dir, "attachments"));
		await attachments.load();

		const messages = messagesFromLog(entries, attachments);
		const session = new Session(engine, dataDir, { id, entries, messages, attachments });
		for (const call of unresolvedToolCalls(messages)) {
			const result = interruptedToolResult(call);
			// Add to the agent's own list, which also holds the system prompt.
			session.agent.state.messages.push(result);
			await session.record({ type: "message", message: result });
		}
		return session;
	}

	private get messages(): Message[] {
		return this.agent.state.messages.filter(
			(message): message is Message => message.role !== ("system" as string),
		);
	}

	/** A reply can be retried if it failed, or if the tail shows the app stopped partway through. */
	get canRetry(): boolean {
		const tail = this.messages.at(-1);
		return (
			!this.running && tail !== undefined && (tail.role !== "assistant" || isFailedReply(tail))
		);
	}

	get hasContent(): boolean {
		return this.entries.length > 0;
	}

	/** Set the type before the first message. It's saved in the header, so it can't change after. */
	chooseType(chatType: ChatType): void {
		if (!this.hasContent) this.chatType = chatType;
	}

	private async record(entry: LogEntry): Promise<void> {
		if (this.entries.length === 0) {
			const header: LogHeader = {
				type: "header",
				version: LOG_VERSION,
				id: this.id,
				createdAt: Date.now(),
				systemPrompt: this.systemPrompt,
				chatType: this.chatType,
			};
			this.entries.push(header);
			await this.log.append(header);
		}
		this.entries.push(entry);
		await this.log.append(entry);
	}

	/** The sidebar reads this small file instead of opening every log. It can always be rebuilt. */
	private async writeSummary(): Promise<void> {
		const path = join(this.dir, "summary.json");
		const summary = this.summary();
		await writeFile(`${path}.tmp`, JSON.stringify(summary));
		await rename(`${path}.tmp`, path);
		this.onSummary?.(summary);
	}

	summary(): SessionSummary {
		return { id: this.id, title: this.title(), updatedAt: Date.now(), chatType: this.chatType };
	}

	searchText(): string {
		return searchTextOf(this.entries);
	}

	private title(): string {
		return titleOf(this.entries, (id) => this.attachments.info(id));
	}

	view(): SessionView {
		const messages = buildTranscript(
			this.entries,
			(id) => this.attachments.info(id),
			(citation) => this.attachments.hasCitation(citation),
		);
		const canRetry = this.canRetry;
		if (canRetry && !isFailedReply(this.messages.at(-1))) markInterrupted(messages);
		const usage = { ...this.usage };
		return { id: this.id, title: this.title(), messages, canRetry, usage, context: this.context() };
	}

	private context() {
		return contextOf(this.entries, (model) => this.engine.contextLimit(model));
	}

	private async run(start: () => Promise<void>, onEvent: (event: RunEvent) => void): Promise<void> {
		const runUsage = emptyUsage();
		let last: AssistantMessage | undefined;
		let writeFailure: string | undefined;
		const startedAt = performance.now();
		let workedMs: number | undefined;
		const unsubscribe = this.agent.subscribe(async (event: AgentEvent) => {
			if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
				if (workedMs === undefined) {
					workedMs = Math.round(performance.now() - startedAt);
					onEvent({ type: "reply_start", workedMs });
				}
				onEvent({ type: "text_delta", delta: event.assistantMessageEvent.delta });
			} else if (
				event.type === "message_update" &&
				event.assistantMessageEvent.type === "thinking_delta"
			) {
				onEvent({ type: "reasoning_delta", delta: event.assistantMessageEvent.delta });
			} else if (event.type === "tool_execution_start") {
				const labels = toolLabels(
					event.toolName,
					event.args,
					(id) => this.attachments.info(id)?.name,
				);
				onEvent({ type: "tool_start", id: event.toolCallId, name: event.toolName, ...labels });
			} else if (event.type === "tool_execution_end") {
				onEvent({
					type: "tool_end",
					id: event.toolCallId,
					isError: event.isError,
					durationMs: event.durationMs,
				});
			} else if (
				event.type === "message_end" &&
				(event.message.role === "assistant" || event.message.role === "toolResult")
			) {
				const isReply = event.message.role === "assistant";
				if (event.message.role === "assistant") {
					last = event.message;
					addUsage(runUsage, last);
					addUsage(this.usage, last);
				}
				const worked = isReply && workedMs !== undefined ? { workedMs } : {};
				// Text before a tool call isn't the end of the work, so the next step measures again.
				if (isReply) workedMs = undefined;
				// Pi waits for this before moving on, so each step is on disk before the next begins.
				try {
					await this.record({
						type: "message",
						message: toStored(event.message, this.attachments),
						...worked,
					});
				} catch (error) {
					writeFailure = `Couldn't save this session: ${(error as Error).message}`;
					this.agent.abort();
				}
			}
		});

		let failure: string | undefined;
		try {
			await start();
			await this.writeSummary();
		} catch (error) {
			failure = error instanceof Error ? error.message : String(error);
		} finally {
			unsubscribe();
			this.running = false;
		}
		failure = writeFailure ?? failure;
		onEvent({
			type: "done",
			stopReason: failure ? "error" : (last?.stopReason ?? "error"),
			errorMessage: failure ?? last?.errorMessage,
			usage: runUsage,
			sessionUsage: { ...this.usage },
			context: this.context(),
		});
	}

	/** Each saved reply names its model, so a new choice needs no record of its own. */
	private use(choice: ResolvedModel): void {
		this.agent.state.model = choice.model;
		this.agent.state.thinkingLevel = choice.thinkingLevel;
	}

	/** Run one learner turn to completion. The message is saved before the model is called. */
	async send(
		input: { text: string; attachmentIds: string[]; viewing?: OpenPage },
		onEvent: (event: RunEvent) => void,
		choice: ResolvedModel,
	): Promise<void> {
		if (this.running) throw new SessionBusyError();
		this.use(choice);
		const { text, attachmentIds, viewing } = input;
		const content = [
			...this.attachments.toContent(attachmentIds),
			...(viewing ? [{ type: "text" as const, text: viewingTag(viewing) }] : []),
			...(text.trim() ? [{ type: "text" as const, text }] : []),
		];
		this.running = true;
		const message: Message = { role: "user", content, timestamp: Date.now() };
		try {
			await this.record({
				type: "message",
				message: toStored(message, this.attachments),
				display: { text, attachmentIds },
			});
		} catch (error) {
			this.running = false;
			throw error;
		}
		await this.run(() => this.agent.prompt(message), onEvent);
	}

	/** Try again after a failed or interrupted reply. */
	async retry(onEvent: (event: RunEvent) => void, choice: ResolvedModel): Promise<void> {
		if (this.running) throw new SessionBusyError();
		if (!this.canRetry) throw new SessionStateError("There's nothing to retry.");
		this.use(choice);
		this.running = true;
		try {
			if (isFailedReply(this.messages.at(-1))) {
				await this.record({ type: "retry", timestamp: Date.now() });
				this.agent.state.messages = this.agent.state.messages.slice(0, -1);
			}
		} catch (error) {
			this.running = false;
			throw error;
		}
		await this.run(() => this.agent.continue(), onEvent);
	}

	get isRunning(): boolean {
		return this.running;
	}

	abort(): void {
		this.agent.abort();
	}
}
