import type { AssistantMessage } from "@earendil-works/pi-ai";
import type {
	AttachmentInfo,
	TranscriptBlock,
	TranscriptMessage,
	UsageSummary,
} from "../../shared/protocol.ts";
import { noticeFor } from "../../shared/protocol.ts";
import type { LogEntry } from "./log.ts";
import { toolLabels } from "../tools.ts";

export const INTERRUPTED_NOTICE = "The app closed before this reply finished.";

type ToolBlock = Extract<TranscriptBlock, { kind: "tool" }>;

/** Add one model step's reasoning, text, and tool calls. Redacted reasoning has no text to show. */
function addReplyParts(
	blocks: TranscriptBlock[],
	content: AssistantMessage["content"],
	toolBlocks: Map<string, ToolBlock>,
	attachmentInfo: (id: string) => AttachmentInfo | undefined,
): void {
	for (const part of content) {
		if (part.type === "text" && part.text) {
			blocks.push({ kind: "text", text: part.text });
		} else if (part.type === "thinking" && part.thinking.trim()) {
			blocks.push({ kind: "reasoning", text: part.thinking });
		} else if (part.type === "toolCall") {
			const { label } = toolLabels(part.name, part.arguments, (id) => attachmentInfo(id)?.name);
			const block: ToolBlock = { kind: "tool", id: part.id, label, state: "running" };
			blocks.push(block);
			toolBlocks.set(part.id, block);
		}
	}
}

/** Replies saved before `workedMs` was recorded estimate it, but only if there's a trace to head. */
function setWorkedTime(
	message: TranscriptMessage,
	saved: number | undefined,
	turn: { start: number; end: number },
): void {
	const hasTrace = message.blocks.some((block) => block.kind !== "text");
	const workedMs = saved ?? (hasTrace ? turn.end - turn.start : undefined);
	if (workedMs === undefined) delete message.workedMs;
	else message.workedMs = workedMs;
}

/**
 * Build what the UI shows from the log. One learner turn can span several model calls and
 * tool results, so they all collapse into one assistant message.
 */
export function buildTranscript(
	entries: LogEntry[],
	attachmentInfo: (id: string) => AttachmentInfo | undefined,
): TranscriptMessage[] {
	const messages: TranscriptMessage[] = [];
	let current: TranscriptMessage | undefined;
	let failedFrom: number | undefined;
	let toolBlocks = new Map<string, ToolBlock>();
	const turn = { start: 0, end: 0 };

	entries.forEach((entry, index) => {
		if (entry.type === "retry") {
			if (current && failedFrom !== undefined) current.blocks.length = failedFrom;
			if (current) {
				delete current.notice;
				delete current.failed;
				delete current.workedMs;
			}
			failedFrom = undefined;
			turn.start = turn.end = entry.timestamp;
			return;
		}
		if (entry.type !== "message") return;
		const { message } = entry;

		if (message.role === "user") {
			const text = entry.display?.text ?? "";
			messages.push({
				id: `m${index}`,
				role: "user",
				blocks: text.trim() ? [{ kind: "text", text }] : [],
				attachments: (entry.display?.attachmentIds ?? []).flatMap((id) => attachmentInfo(id) ?? []),
			});
			current = undefined;
			failedFrom = undefined;
			toolBlocks = new Map();
			turn.start = turn.end = message.timestamp;
			return;
		}

		if (!current) {
			current = { id: `m${index}`, role: "assistant", blocks: [] };
			messages.push(current);
		}

		if (message.role === "assistant") {
			const start = current.blocks.length;
			addReplyParts(current.blocks, message.content, toolBlocks, attachmentInfo);
			turn.end = message.timestamp + (message.durationMs ?? 0);
			const ending = noticeFor(message.stopReason, message.errorMessage);
			if (ending) {
				current.notice = ending.notice;
				current.failed = ending.failed;
				if (ending.failed) failedFrom = start;
			}
		} else if (message.role === "toolResult") {
			const block = toolBlocks.get(message.toolCallId);
			if (block) block.state = message.isError ? "failed" : "done";
			// A tool cut off by a crash is settled at the next launch, so its time says nothing.
			if (message.durationMs !== undefined) {
				if (block) block.durationMs = message.durationMs;
				turn.end = message.timestamp;
			}
		}

		setWorkedTime(current, entry.workedMs, turn);
	});
	return messages;
}

/** The words the learner can see in a chat. Attachments aren't read, so their contents aren't included. */
export function searchTextOf(entries: LogEntry[]): string {
	return buildTranscript(entries, () => undefined)
		.flatMap((message) => message.blocks)
		.flatMap((block) => (block.kind === "text" ? [block.text] : []))
		.join("\n");
}

export function addUsage(total: UsageSummary, message: AssistantMessage): void {
	const { usage } = message;
	total.inputTokens += usage.input + usage.cacheRead + usage.cacheWrite;
	total.outputTokens += usage.output;
	total.costUsd += usage.cost.total;
}

export function usageOf(entries: LogEntry[]): UsageSummary {
	const total: UsageSummary = { inputTokens: 0, outputTokens: 0, costUsd: 0 };
	for (const entry of entries) {
		if (entry.type === "message" && entry.message.role === "assistant")
			addUsage(total, entry.message);
	}
	return total;
}

export function titleOf(
	entries: LogEntry[],
	attachmentInfo: (id: string) => AttachmentInfo | undefined,
): string {
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
