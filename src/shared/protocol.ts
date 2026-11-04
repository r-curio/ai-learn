/** The wire contract between the local server and the UI. */

export type AttachmentKind = "image" | "pdf" | "text";

export interface AttachmentInfo {
	id: string;
	name: string;
	kind: AttachmentKind;
	size: number;
}

export interface UsageSummary {
	inputTokens: number;
	outputTokens: number;
	costUsd: number;
}

export type RunEvent =
	| { type: "text_delta"; delta: string }
	| { type: "tool_start"; id: string; name: string; label: string }
	| { type: "tool_end"; id: string; isError: boolean }
	| {
			type: "done";
			stopReason: string;
			errorMessage?: string;
			usage: UsageSummary;
			sessionUsage: UsageSummary;
	  };

export interface EngineStatus {
	ready: boolean;
	model: string;
	reason?: string;
}

export interface SessionSummary {
	id: string;
	title: string;
	updatedAt: number;
}

export type TranscriptBlock =
	| { kind: "text"; text: string }
	| { kind: "tool"; id: string; label: string; state: "running" | "done" | "failed" };

export interface TranscriptMessage {
	id: string;
	role: "user" | "assistant";
	blocks: TranscriptBlock[];
	attachments?: AttachmentInfo[];
	notice?: string;
	failed?: boolean;
}

export interface SessionView {
	id: string;
	title: string;
	messages: TranscriptMessage[];
	canRetry: boolean;
	usage: UsageSummary;
}

/** What to tell the learner about how a reply ended. Nothing, if it ended normally. */
export function noticeFor(
	stopReason: string,
	errorMessage?: string,
): { notice: string; failed?: boolean } | undefined {
	if (stopReason === "stop" || stopReason === "toolUse") return undefined;
	if (stopReason === "aborted") return { notice: "Stopped." };
	if (stopReason === "length")
		return { notice: "This reply hit the length limit and was cut off." };
	return { notice: errorMessage ?? "The response failed.", failed: true };
}
