import type {
	AssistantMessage,
	ImageContent,
	Message,
	TextContent,
	ToolResultMessage,
	UserMessage,
} from "@earendil-works/pi-ai";
import { appendFile, mkdir, readFile, truncate } from "node:fs/promises";
import { dirname } from "node:path";
import type { ChatType } from "../../shared/protocol.ts";
import type { AttachmentStore } from "../attachments.ts";

export const LOG_VERSION = 1;

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
	systemPrompt: string;
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
}

/** Marks a failed reply as replaced, so it's no longer shown or resent. */
export interface LogRetry {
	type: "retry";
	timestamp: number;
}

export type LogEntry = LogHeader | LogMessage | LogRetry;

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
