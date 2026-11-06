import type { RunEvent, TranscriptMessage } from "../../shared/protocol.ts";

type StreamedKind = "text" | "reasoning";

function appendText(
	message: TranscriptMessage,
	kind: StreamedKind,
	delta: string,
): TranscriptMessage {
	const last = message.blocks.at(-1);
	return last?.kind === kind
		? {
				...message,
				blocks: [...message.blocks.slice(0, -1), { kind, text: last.text + delta }],
			}
		: { ...message, blocks: [...message.blocks, { kind, text: delta }] };
}

/** Apply one streamed event to the reply being shown. The server's copy replaces it when the run ends. */
export function applyRunEvent(message: TranscriptMessage, event: RunEvent): TranscriptMessage {
	if (event.type === "text_delta") return appendText(message, "text", event.delta);
	if (event.type === "reply_start") return { ...message, workedMs: event.workedMs };
	if (event.type === "reasoning_delta") {
		return { ...appendText(message, "reasoning", event.delta), workedMs: undefined };
	}
	if (event.type === "tool_start") {
		const { id, label, runningLabel } = event;
		return {
			...message,
			workedMs: undefined,
			blocks: [...message.blocks, { kind: "tool", id, label, runningLabel, state: "running" }],
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
