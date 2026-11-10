import type {
	AssistantMessage,
	ImageContent,
	Message,
	SystemMessage,
	TextContent,
	ToolResultMessage,
	UserMessage,
} from "@earendil-works/pi-ai";
import { appendFile, mkdir, readFile, rename, truncate, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { SceneElement } from "../../shared/drawing.ts";
import type { ChatType, QuestionAnswer, SessionSummary } from "../../shared/protocol.ts";
import type { AttachmentStore } from "../attachments.ts";

/** 2 added `phases` to the header. Version 1 logs have a single prompt and read as before. */
export const LOG_VERSION = 2;

/**
 * The session log is the source of truth: one JSON record per line, only ever appended to.
 * Model replies are stored exactly as received because Claude rejects or discards reasoning
 * data when earlier history has changed. The only rewrite is trimming a half-written last line.
 */
export interface LogHeader {
	type: "header";
	version: number;
	id: string;
	createdAt: number;
	/** The whole prompt, or in a phased chat the part every phase shares. */
	systemPrompt: string;
	/** A Learning chat's phase prompts, each sent as the `phase` section. Older logs and Practice chats have none. */
	phases?: { prober: string; teacher: string };
	/** Older logs don't have this, and count as Learning. */
	chatType?: ChatType;
}

export interface LogMessage {
	type: "message";
	message: StoredMessage;
	/** What the learner typed, separate from the attachment text sent to the model. */
	display?: { text: string; attachmentIds: string[] };
	/** On a reply with text: how long the run had taken when that text started. Never sent to the model. */
	workedMs?: number;
	/** On the result of a question: the learner's answer, as they gave it. The model gets the result's text. */
	answer?: QuestionAnswer;
	/** On a learner's message: their edit of one of the tutor's drawings. The model gets a `<diagram-edit>` tag. */
	drawingEdit?: { callId: string; elements: SceneElement[] };
}

/** Marks a failed reply as replaced, so it's no longer shown or resent. */
export interface LogRetry {
	type: "retry";
	timestamp: number;
}

/**
 * Pi's note that the tools or the prompt changed, like a search key being added or the probe handing
 * over to the teacher. Kept so a reload sends the same history.
 */
export interface LogTools {
	type: "tools";
	message: SystemMessage;
}

/**
 * A chat's title, written by the tutor or set by the learner. The learner's latest one wins, then the
 * tutor's latest, then the start of the first message. It's never sent to the model, and older builds skip it.
 */
export interface LogTitle {
	type: "title";
	title: string;
	by: "tutor" | "learner";
	timestamp: number;
}

export type LogEntry = LogHeader | LogMessage | LogRetry | LogTools | LogTitle;

/** An image in the log is a reference to its attachment, which keeps the log small. */
export interface StoredImage {
	type: "image";
	attachmentId: string;
	mimeType: string;
}

type StoredContent = TextContent | ImageContent | StoredImage;
export type StoredMessage =
	| AssistantMessage
	| (Omit<UserMessage, "content"> & { content: string | StoredContent[] })
	| (Omit<ToolResultMessage, "content"> & { content: StoredContent[] });

export class SessionLogError extends Error {}

export function toStored(message: Message, attachments: AttachmentStore): StoredMessage {
	if (
		(message.role !== "user" && message.role !== "toolResult") ||
		typeof message.content === "string"
	)
		return message as StoredMessage;
	return {
		...message,
		content: message.content.map((part): StoredContent => {
			if (part.type !== "image") return part;
			const attachmentId = attachments.idForImage(part.data);
			return attachmentId ? { type: "image", attachmentId, mimeType: part.mimeType } : part;
		}),
	};
}

export function fromStored(stored: StoredMessage, attachments: AttachmentStore): Message {
	if (
		(stored.role !== "user" && stored.role !== "toolResult") ||
		typeof stored.content === "string"
	)
		return stored as Message;
	return {
		...stored,
		content: stored.content.map((part) => {
			if (part.type !== "image" || !("attachmentId" in part)) return part;
			const data = attachments.imageData(part.attachmentId);
			if (data === undefined)
				throw new SessionLogError(`A saved image is missing: ${part.attachmentId}`);
			return { type: "image", data, mimeType: part.mimeType };
		}),
	};
}

/** Read a log, repairing a last line cut short by a crash. Any other damage is an error. */
export async function readLog(path: string): Promise<LogEntry[]> {
	const raw = await readFile(path);
	const complete = completeLines(raw);
	if (complete.length < raw.length) await truncate(path, complete.length);
	return parseLog(complete);
}

/**
 * Read a log without changing it, ignoring a half-written last line.
 * Safe while a reply is being saved, which `readLog`'s repair is not.
 */
export async function peekLog(path: string): Promise<LogEntry[]> {
	return parseLog(completeLines(await readFile(path)));
}

function completeLines(raw: Buffer): Buffer {
	return raw.subarray(0, raw.lastIndexOf(0x0a) + 1);
}

function parseLog(complete: Buffer): LogEntry[] {
	const entries = complete
		.toString("utf8")
		.split("\n")
		.filter(Boolean)
		.map((line, index) => {
			try {
				return JSON.parse(line) as LogEntry;
			} catch {
				throw new SessionLogError(`Session log is damaged at line ${index + 1}.`);
			}
		});
	const header = entries[0];
	if (header?.type !== "header") throw new SessionLogError("Session log has no header.");
	if (header.version > LOG_VERSION)
		throw new SessionLogError("This session was saved by a newer version of ai-learn.");
	return entries;
}

/** Appends records in order, each flushed to disk before its promise resolves. */
export class LogWriter {
	private queue: Promise<void> = Promise.resolve();

	constructor(private readonly path: string) {}

	append(entry: LogEntry): Promise<void> {
		const write = this.queue.then(async () => {
			await mkdir(dirname(this.path), { recursive: true });
			await appendFile(this.path, `${JSON.stringify(entry)}\n`, { flush: true });
		});
		this.queue = write.catch(() => undefined);
		return write;
	}
}

/**
 * Replaces `summary.json`, which the sidebar reads instead of opening every log. It can always be
 * rebuilt. Writes take turns, since a title can arrive while the next reply is saving.
 */
export class SummaryWriter {
	private queue: Promise<void> = Promise.resolve();

	constructor(private readonly path: string) {}

	write(summary: SessionSummary): Promise<void> {
		const write = this.queue.then(async () => {
			await writeFile(`${this.path}.tmp`, JSON.stringify(summary));
			await rename(`${this.path}.tmp`, this.path);
		});
		this.queue = write.catch(() => undefined);
		return write;
	}
}
