import type { RunEvent, TranscriptMessage } from "../../shared/protocol.ts";

/** Apply one streamed event to the reply being shown. The server's copy replaces it when the run ends. */
export function applyRunEvent(message: TranscriptMessage, event: RunEvent): TranscriptMessage {
	if (event.type === "text_delta") {
		const last = message.blocks.at(-1);
		return last?.kind === "text"
			? {
					...message,
					blocks: [...message.blocks.slice(0, -1), { kind: "text", text: last.text + event.delta }],
				}
			: { ...message, blocks: [...message.blocks, { kind: "text", text: event.delta }] };
	}
	if (event.type === "tool_start") {
		return {
			...message,
			blocks: [
				...message.blocks,
				{ kind: "tool", id: event.id, label: event.label, state: "running" },
			],
		};
	}
	if (event.type === "tool_end") {
		return {
			...message,
			blocks: message.blocks.map((block) =>
				block.kind === "tool" && block.id === event.id
					? { ...block, state: event.isError ? "failed" : "done" }
					: block,
			),
		};
	}
	return message;
}
