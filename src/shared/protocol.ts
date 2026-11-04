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
	| { type: "done"; stopReason: string; errorMessage?: string; usage: UsageSummary; sessionUsage: UsageSummary };

export interface EngineStatus {
	ready: boolean;
	model: string;
	reason?: string;
}
