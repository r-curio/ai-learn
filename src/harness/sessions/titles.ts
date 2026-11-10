import type { AssistantMessage, ToolResultMessage } from "@earendil-works/pi-ai";
import type { AttachmentInfo } from "../../shared/protocol.ts";
import { FINISH_PROBE } from "../prompts/finish-probe.ts";
import { cleanTitle, type TitleSource } from "../title.ts";
import type { LogEntry, LogTitle } from "./log.ts";
import { buildTranscript } from "./transcript.ts";

type AttachmentLookup = (id: string) => AttachmentInfo | undefined;

const titles = (entries: LogEntry[], by?: LogTitle["by"]) =>
	entries.filter(
		(entry): entry is LogTitle => entry.type === "title" && (by === undefined || entry.by === by),
	);

/** The start of the first message, as every chat was titled before titles were saved. */
function firstMessageTitle(entries: LogEntry[], attachmentInfo: AttachmentLookup): string {
	for (const entry of entries) {
		if (entry.type !== "message" || entry.message.role !== "user") continue;
		const text = entry.display?.text.trim().replace(/\s+/g, " ");
		if (text) return text.length > 60 ? `${text.slice(0, 59)}…` : text;
		const first = entry.display?.attachmentIds[0];
		const name = first ? attachmentInfo(first)?.name : undefined;
		if (name) return name;
	}
	return "New chat";
}

/** The learner's latest title, then the tutor's latest, then the start of the first message. */
export function titleOf(entries: LogEntry[], attachmentInfo: AttachmentLookup): string {
	const saved = titles(entries, "learner").at(-1) ?? titles(entries, "tutor").at(-1);
	return saved?.title ?? firstMessageTitle(entries, attachmentInfo);
}

/** When the chat last saved a message, so a new title doesn't move it up the chat list. */
export function lastMessageAt(entries: LogEntry[]): number | undefined {
	const last = entries.findLast((entry) => entry.type === "message");
	return last?.type === "message" ? last.message.timestamp : undefined;
}

/** A reply that finished, even if only by asking a question. A failed or stopped one doesn't count. */
const hasReply = (entries: LogEntry[]) =>
	entries.some(
		(entry) =>
			entry.type === "message" &&
			entry.message.role === "assistant" &&
			["stop", "toolUse", "length"].includes(entry.message.stopReason),
	);

/** What the learner saw of the first turn: their message, and the first reply with something to read. */
function firstExchange(entries: LogEntry[], attachmentInfo: AttachmentLookup) {
	const messages = buildTranscript(entries, attachmentInfo);
	const textOf = (message: (typeof messages)[number]) =>
		message.blocks.flatMap((block) =>
			block.kind === "text" || block.kind === "question" ? [block.text] : [],
		);
	const learner = messages.find((message) => message.role === "user");
	const reply = messages.find(
		(message) => message.role === "assistant" && !message.failed && textOf(message).length > 0,
	);
	if (!learner || !reply) return undefined;
	const names = (learner.attachments ?? []).map((attachment) => attachment.name);
	const said = textOf(learner).join("\n");
	return { learner: said || names.join(", "), reply: textOf(reply).join("\n\n") };
}

/** The goal a successful `finish_probe` call saved, read from the call's arguments. */
function probeGoal(reply: AssistantMessage | undefined, result: ToolResultMessage) {
	if (result.toolName !== FINISH_PROBE || result.isError) return undefined;
	const call = reply?.content.find(
		(part) => part.type === "toolCall" && part.id === result.toolCallId,
	);
	const goal = call?.type === "toolCall" ? (call.arguments as { goal?: unknown }).goal : undefined;
	return typeof goal === "string" ? cleanTitle(goal) : undefined;
}

/**
 * Decides when a chat's title is saved. The tutor names a chat once from its first reply, then again
 * from a finished probe's goal, and never over a title the learner set.
 */
interface TitleOptions {
	attachmentInfo: AttachmentLookup;
	/** Saves a title in the log, then the summary. */
	save: (entry: LogTitle) => Promise<void>;
	/** Writes a title from the first turn with a model call. */
	write: (source: TitleSource) => Promise<string | undefined>;
}

export class ChatTitles {
	private closed = false;

	constructor(
		private readonly entries: LogEntry[],
		private readonly options: TitleOptions,
	) {}

	get current(): string {
		return titleOf(this.entries, this.options.attachmentInfo);
	}

	/** True until a reply has finished, so the run that writes the first one knows to name the chat. */
	get awaitingFirstReply(): boolean {
		return titles(this.entries).length === 0 && !hasReply(this.entries);
	}

	/** The chat is being deleted, so a title call that finishes later must not recreate its folder. */
	close(): void {
		this.closed = true;
	}

	private async saveTutorTitle(title: string): Promise<string | undefined> {
		if (this.closed) return undefined;
		await this.options.save({ type: "title", title, by: "tutor", timestamp: Date.now() });
		return title;
	}

	/** Saves the probe's goal as the title, and returns it, unless the learner has named the chat. */
	async fromProbe(reply: AssistantMessage | undefined, result: ToolResultMessage) {
		const goal = probeGoal(reply, result);
		if (!goal || titles(this.entries, "learner").length > 0) return undefined;
		return this.saveTutorTitle(goal);
	}

	/**
	 * Asks for a title from the first turn and saves it, unless a title was saved meanwhile.
	 * A failed call leaves the chat with the title it has, and shows the learner nothing.
	 */
	async fromFirstReply() {
		const source = firstExchange(this.entries, this.options.attachmentInfo);
		if (!source || titles(this.entries).length > 0) return undefined;
		try {
			const title = await this.options.write(source);
			if (!title || titles(this.entries).length > 0) return undefined;
			return await this.saveTutorTitle(title);
		} catch (error) {
			console.error(`Couldn't write a chat title: ${(error as Error).message}`);
			return undefined;
		}
	}

	/** The learner's title, with its spacing tidied. It always wins over the tutor's. */
	async rename(typed: string): Promise<string> {
		const title = typed.trim().replace(/\s+/g, " ");
		if (!title) throw new Error("A chat needs a title.");
		await this.options.save({ type: "title", title, by: "learner", timestamp: Date.now() });
		return title;
	}
}
