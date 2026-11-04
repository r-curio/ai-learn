import type { AttachmentInfo, TranscriptBlock, TranscriptMessage, UsageSummary } from "../shared/protocol.ts";
import { noticeFor } from "../shared/protocol.ts";
import type { LogEntry } from "./log.ts";
import { TOOL_LABELS } from "./tools.ts";

export const INTERRUPTED_NOTICE = "The app closed before this reply finished.";

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
	let toolBlocks = new Map<string, Extract<TranscriptBlock, { kind: "tool" }>>();

	entries.forEach((entry, index) => {
		if (entry.type === "retry") {
			if (current && failedFrom !== undefined) current.blocks.length = failedFrom;
			if (current) {
				delete current.notice;
				delete current.failed;
			}
			failedFrom = undefined;
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
			return;
		}

		if (!current) {
			current = { id: `m${index}`, role: "assistant", blocks: [] };
			messages.push(current);
		}

		if (message.role === "assistant") {
			const start = current.blocks.length;
			for (const part of message.content) {
				if (part.type === "text" && part.text) {
					current.blocks.push({ kind: "text", text: part.text });
				} else if (part.type === "toolCall") {
					const block = { kind: "tool" as const, id: part.id, label: TOOL_LABELS[part.name] ?? part.name, state: "running" as const };
					current.blocks.push(block);
					toolBlocks.set(part.id, block as Extract<TranscriptBlock, { kind: "tool" }>);
				}
			}
			const ending = noticeFor(message.stopReason, message.errorMessage);
			if (ending) {
				current.notice = ending.notice;
				current.failed = ending.failed;
				if (ending.failed) failedFrom = start;
			}
		} else if (message.role === "toolResult") {
			const block = toolBlocks.get(message.toolCallId);
			if (block) block.state = message.isError ? "failed" : "done";
		}
	});
	return messages;
}

export function usageOf(entries: LogEntry[]): UsageSummary {
	const total: UsageSummary = { inputTokens: 0, outputTokens: 0, costUsd: 0 };
	for (const entry of entries) {
		if (entry.type !== "message" || entry.message.role !== "assistant") continue;
		const { usage } = entry.message;
		total.inputTokens += usage.input + usage.cacheRead + usage.cacheWrite;
		total.outputTokens += usage.output;
		total.costUsd += usage.cost.total;
	}
	return total;
}

export function titleOf(entries: LogEntry[], attachmentInfo: (id: string) => AttachmentInfo | undefined): string {
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
