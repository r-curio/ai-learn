import type { Agent, AgentEvent } from "@earendil-works/pi-agent-core";
import type { AssistantMessage, Message } from "@earendil-works/pi-ai";
import { randomUUID } from "node:crypto";
import { rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { DrawingEdit } from "../../shared/drawing.ts";
import {
	chatTypeOf,
	type ChatType,
	type OpenPage,
	type Question,
	type QuestionAnswer,
	type RunEvent,
	type SessionSummary,
	type SessionView,
	type UsageSummary,
} from "../../shared/protocol.ts";
import { AttachmentStore } from "../attachments.ts";
import { editContent } from "../drawings/edits.ts";
import type { Engine, ResolvedModel } from "../engine.ts";
import { LOG_VERSION, LogWriter, readLog, toStored, type LogEntry, type LogHeader } from "./log.ts";
import {
	interruptedToolResult,
	isFailedReply,
	messagesFromLog,
	unresolvedToolCalls,
} from "./recovery.ts";
import {
	answerResult,
	gradeOf,
	pendingQuestionIn,
	questionPlaceholder,
	waitingIn,
} from "./questions.ts";
import { runProgress } from "./run-progress.ts";
import { initialSystemMessage } from "../tools.ts";
import { createTutorAgent, offerTools } from "../tutor-agent.ts";
import { searchLimitNotice } from "../web/web-tools.ts";
import { promptFor, promptOf, type SessionPrompt } from "../prompts/phases.ts";
import { viewingTag } from "../prompts/tutor-prompt.ts";
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
	private prompt: SessionPrompt;
	private chatType: ChatType;
	private running = false;
	private readonly offerTools: () => Promise<void>;

	constructor(engine: Engine, dataDir: string, restored?: Restored) {
		this.engine = engine;
		this.id = restored?.id ?? randomUUID();
		this.dir = join(dataDir, "sessions", this.id);
		this.attachments = restored?.attachments ?? new AttachmentStore(join(this.dir, "attachments"));
		this.log = new LogWriter(join(this.dir, "session.jsonl"));
		this.entries = restored?.entries ?? [];
		this.usage = usageOf(this.entries);
		const header = this.entries[0] as LogHeader | undefined;
		this.chatType = chatTypeOf(header?.chatType);
		this.prompt = promptOf(header, this.chatType);
		this.agent = createTutorAgent({
			sessionId: this.id,
			prompt: this.prompt,
			attachments: this.attachments,
			messages: restored?.messages ?? [],
			streamFn: engine.streamFn,
		});
		this.offerTools = () =>
			offerTools(this.agent.state, this.prompt, this.attachments, engine, (e) => this.record(e));
	}

	/** Rebuild a session from disk and settle anything a crash left unfinished. */
	static async load(engine: Engine, dataDir: string, id: string): Promise<Session> {
		const dir = join(dataDir, "sessions", id);
		const entries = await readLog(join(dir, "session.jsonl"));
		const attachments = new AttachmentStore(join(dir, "attachments"));
		await attachments.load();

		const messages = messagesFromLog(entries, attachments);
		const session = new Session(engine, dataDir, { id, entries, messages, attachments });
		const waiting = pendingQuestionIn(messages)?.id;
		for (const call of unresolvedToolCalls(messages)) {
			if (call.id === waiting) continue;
			const result = interruptedToolResult(call);
			// Add to the agent's own list, which also holds the system prompt.
			session.agent.state.messages.push(result);
			await session.record({ type: "message", message: result });
		}
		return session;
	}

	private get messages(): Message[] {
		return this.agent.state.messages.filter((m): m is Message => m.role !== ("system" as string));
	}

	/** A reply can be retried if it failed, or if the tail shows the app stopped partway through. */
	get canRetry(): boolean {
		const tail = this.messages.at(-1);
		return (
			!this.running &&
			!this.pendingQuestion &&
			tail !== undefined &&
			(tail.role !== "assistant" || isFailedReply(tail))
		);
	}

	/** The question the tutor is waiting on: a saved tool call with no result yet. */
	get pendingQuestion(): Question | undefined {
		return this.running ? undefined : pendingQuestionIn(this.messages);
	}

	get hasContent(): boolean {
		return this.entries.length > 0;
	}

	/** Set the type, and with it the prompt, before the first message. Both are saved in the header. */
	chooseType(chatType: ChatType): void {
		if (this.hasContent) return;
		this.chatType = chatType;
		this.prompt = promptFor(chatType);
		this.agent.state.messages = initialSystemMessage(this.prompt, this.attachments);
	}

	private async record(entry: LogEntry): Promise<void> {
		if (this.entries.length === 0) {
			const header: LogHeader = {
				type: "header",
				version: LOG_VERSION,
				id: this.id,
				createdAt: Date.now(),
				...this.prompt,
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
		const tail = this.messages.at(-1);
		if (canRetry && !isFailedReply(tail)) markInterrupted(messages, searchLimitNotice(tail));
		const usage = { ...this.usage };
		return {
			id: this.id,
			title: this.title(),
			messages,
			canRetry,
			usage,
			context: this.context(),
			pendingQuestion: this.pendingQuestion,
		};
	}

	private context() {
		return contextOf(this.entries, (model) => this.engine.contextLimit(model));
	}

	private async run(start: () => Promise<void>, onEvent: (event: RunEvent) => void): Promise<void> {
		const runUsage = emptyUsage();
		let last: AssistantMessage | undefined;
		let writeFailure: string | undefined;
		const placeholders = new Set<string>();
		const progress = runProgress(onEvent, (id) => this.attachments.info(id)?.name);
		const unsubscribe = this.agent.subscribe(async (event: AgentEvent) => {
			progress.report(event);
			if (event.type !== "message_end") return;
			const { message } = event;
			if (message.role !== "assistant" && message.role !== "toolResult") return;
			if (message.role === "toolResult" && questionPlaceholder(message)) {
				placeholders.add(message.toolCallId);
				return;
			}
			if (message.role === "assistant") {
				last = message;
				addUsage(runUsage, message);
				addUsage(this.usage, message);
			}
			const worked = message.role === "assistant" ? progress.takeWorkedTime() : {};
			// Pi waits for this before moving on, so each step is on disk before the next begins.
			try {
				await this.record({
					type: "message",
					message: toStored(message, this.attachments),
					...worked,
				});
			} catch (error) {
				writeFailure = `Couldn't save this session: ${(error as Error).message}`;
				this.agent.abort();
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
			this.agent.state.messages = this.agent.state.messages.filter(
				(message) => message.role !== "toolResult" || !placeholders.has(message.toolCallId),
			);
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
		input: { text: string; attachmentIds: string[]; viewing?: OpenPage; edit?: DrawingEdit },
		onEvent: (event: RunEvent) => void,
		choice: ResolvedModel,
	): Promise<void> {
		if (this.running) throw new SessionBusyError();
		if (this.pendingQuestion) throw new SessionStateError("Answer the tutor's question first.");
		this.use(choice);
		const { text, attachmentIds, viewing, edit } = input;
		const seesImages = choice.model.input.includes("image");
		const edited = edit && editContent(this.messages, edit, this.attachments, seesImages);
		if (edit && !edited) throw new SessionStateError("That drawing isn't in this chat.");
		const content = [
			...this.attachments.toContent(attachmentIds),
			...(viewing ? [{ type: "text" as const, text: viewingTag(viewing) }] : []),
			...(edited ?? []),
			...(text.trim() ? [{ type: "text" as const, text }] : []),
		];
		const message: Message = { role: "user", content, timestamp: Date.now() };
		const entry: LogEntry = {
			type: "message",
			message: toStored(message, this.attachments),
			display: { text, attachmentIds },
			...(edit ? { drawingEdit: { callId: edit.callId, elements: edit.elements } } : {}),
		};
		await this.saveThenRun(entry, () => this.agent.prompt(message), onEvent);
	}

	private async saveThenRun(
		entry: LogEntry,
		start: () => Promise<void>,
		onEvent: (event: RunEvent) => void,
	): Promise<void> {
		this.running = true;
		try {
			if (entry.type === "message" && entry.message.role === "user") await this.offerTools();
			await this.record(entry);
		} catch (error) {
			this.running = false;
			throw error;
		}
		await this.run(start, onEvent);
	}

	/** Give the tutor the learner's answer and carry on. The answer is saved before the model is called. */
	async answer(
		questionId: string,
		answer: QuestionAnswer,
		onEvent: (event: RunEvent) => void,
		choice: ResolvedModel,
	): Promise<void> {
		if (this.running) throw new SessionBusyError();
		const asked = waitingIn(this.messages);
		if (asked?.question.id !== questionId)
			throw new SessionStateError("That question isn't waiting for an answer.");
		this.use(choice);
		const result = answerResult(asked, answer);
		const start = () => {
			// The answer is on disk now, so the learner can see how a quiz went before the tutor replies.
			if (asked.key) onEvent({ type: "graded", grade: gradeOf(asked.key, answer) });
			this.agent.state.messages.push(result);
			return this.offerTools().then(() => this.agent.continue());
		};
		await this.saveThenRun({ type: "message", message: result, answer }, start, onEvent);
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
			await this.offerTools();
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
