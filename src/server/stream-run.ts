import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import type { Session } from "../harness/sessions/session.ts";
import { SessionBusyError, SessionStateError } from "../harness/sessions/session.ts";
import type { RunEvent } from "../shared/protocol.ts";

const NO_USAGE = { inputTokens: 0, outputTokens: 0, costUsd: 0 };

/**
 * Stream a run's events to the client. A client that disconnects before `done` stops the run. A
 * new chat's title can follow `done`, while the session may already be running the next turn.
 */
export function streamRun(
	c: Context,
	session: Session,
	run: (onEvent: (event: RunEvent) => void) => Promise<void>,
) {
	return streamSSE(c, async (stream) => {
		let live = true;
		stream.onAbort(() => {
			if (live) session.abort();
		});
		let writes = Promise.resolve();
		const emit = (event: RunEvent) => {
			if (event.type === "done") live = false;
			writes = writes.then(() => stream.writeSSE({ data: JSON.stringify(event) }));
		};
		try {
			await run(emit);
		} catch (error) {
			const expected = error instanceof SessionBusyError || error instanceof SessionStateError;
			if (!expected) console.error(error);
			emit({
				type: "done",
				stopReason: "error",
				errorMessage: expected ? error.message : "The response failed.",
				usage: NO_USAGE,
				sessionUsage: NO_USAGE,
			});
		}
		await writes;
	});
}
