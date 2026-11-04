import type { Message, ToolResultMessage } from "@earendil-works/pi-ai";
import type { AttachmentStore } from "../attachments.ts";
import { fromStored, type LogEntry } from "./log.ts";

export const isFailedReply = (message: Message | undefined): boolean =>
	message?.role === "assistant" && message.stopReason === "error";

/** The history to send the model, leaving out failed replies that a retry replaced. */
export function messagesFromLog(entries: LogEntry[], attachments: AttachmentStore): Message[] {
	const messages: Message[] = [];
	for (const entry of entries) {
		if (entry.type === "message") messages.push(fromStored(entry.message, attachments));
		else if (entry.type === "retry" && isFailedReply(messages.at(-1))) messages.pop();
	}
	return messages;
}

/** Tool calls in the latest reply that never got a result, for example after a crash. */
export function unresolvedToolCalls(messages: Message[]): { id: string; name: string }[] {
	const lastReply = messages.findLastIndex((message) => message.role === "assistant");
	const reply = messages[lastReply];
	if (reply?.role !== "assistant" || reply.stopReason !== "toolUse") return [];
	const answered = new Set(
		messages
			.slice(lastReply + 1)
			.flatMap((message) => (message.role === "toolResult" ? [message.toolCallId] : [])),
	);
	return reply.content.flatMap((part) =>
		part.type === "toolCall" && !answered.has(part.id) ? [{ id: part.id, name: part.name }] : [],
	);
}

/** The result recorded for a tool that a crash cut off. The tool is never rerun. */
export function interruptedToolResult(call: { id: string; name: string }): ToolResultMessage {
	return {
		role: "toolResult",
		toolCallId: call.id,
		toolName: call.name,
		content: [
			{
				type: "text",
				text: "The app closed before this tool finished, so there is no result.",
			},
		],
		isError: true,
		timestamp: Date.now(),
	};
}
