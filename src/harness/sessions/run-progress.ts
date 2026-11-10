import type { AgentEvent } from "@earendil-works/pi-agent-core";
import type { TextContent } from "@earendil-works/pi-ai";
import type { RunEvent } from "../../shared/protocol.ts";
import { drawingIn } from "../drawing-tools.ts";
import { isQuestionTool, toolLabels } from "../tools.ts";
import { isSearchLimit, SEARCH_LIMIT_LABEL } from "../web/web-tools.ts";

/** Turns Pi's events into what the UI shows during a run, and times how long the tutor worked. */
export function runProgress(
	onEvent: (event: RunEvent) => void,
	attachmentName: (id: string) => string | undefined,
) {
	const startedAt = performance.now();
	let workedMs: number | undefined;

	function report(event: AgentEvent): void {
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
		} else if (event.type === "tool_execution_start" && !isQuestionTool(event.toolName)) {
			const labels = toolLabels(event.toolName, event.args, attachmentName);
			onEvent({ type: "tool_start", id: event.toolCallId, name: event.toolName, ...labels });
		} else if (event.type === "tool_execution_end" && !isQuestionTool(event.toolName)) {
			const { content = [] } = (event.result ?? {}) as { content?: TextContent[] };
			onEvent({
				type: "tool_end",
				id: event.toolCallId,
				isError: event.isError,
				durationMs: event.durationMs,
				...(isSearchLimit({ isError: event.isError, content })
					? { label: SEARCH_LIMIT_LABEL }
					: {}),
			});
			const result = event.result as { details?: unknown } | undefined;
			const drawing = drawingIn({ ...event, details: result?.details });
			if (drawing) onEvent({ type: "drawing", id: event.toolCallId, drawing });
		}
	}

	/** The time to save on a finished reply. Text before a tool call isn't the end of the work, so the next step measures again. */
	function takeWorkedTime(): { workedMs?: number } {
		const worked = workedMs === undefined ? {} : { workedMs };
		workedMs = undefined;
		return worked;
	}

	return { report, takeWorkedTime };
}
