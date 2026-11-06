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
	| { type: "reasoning_delta"; delta: string }
	/** The reply's text is starting, so the Activity block collapses and its time stops here. */
	| { type: "reply_start"; workedMs: number }
	| { type: "tool_start"; id: string; name: string; label: string; runningLabel: string }
	| { type: "tool_end"; id: string; isError: boolean; durationMs?: number }
	| {
			type: "done";
			stopReason: string;
			errorMessage?: string;
			usage: UsageSummary;
			sessionUsage: UsageSummary;
	  };

export const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
export type Effort = (typeof EFFORTS)[number];

export interface ModelRef {
	provider: string;
	id: string;
}

/** The model a learner picked for one turn. Models with no effort setting leave it out. */
export interface ModelSelection extends ModelRef {
	effort?: Effort;
}

/** Settings the learner chooses, kept in the data folder so they survive a restart. */
export interface Preferences {
	sidebarOpen: boolean;
	model?: ModelRef;
	effort?: Effort;
}

export interface ModelOption extends ModelRef {
	label: string;
	contextWindow: number;
	/** US dollars per 1M tokens. */
	inputPrice: number;
	outputPrice: number;
	/** Empty when the model has no effort setting. */
	efforts: Effort[];
}

export interface ProviderOption {
	id: string;
	label: string;
	models: ModelOption[];
	/** Only a saved key can be removed in the app. */
	keySource: "saved" | "environment";
}

/** A provider that can be connected by adding a key. */
export interface AddableProvider {
	id: string;
	label: string;
	modelCount: number;
}

export interface EngineStatus {
	ready: boolean;
	/** Only the providers that can be used right now. */
	providers: ProviderOption[];
	addable: AddableProvider[];
	/** Why keys can't be saved encrypted here. Missing when they can. */
	keysUnavailable?: string;
	reason?: string;
}

export interface SessionSummary {
	id: string;
	title: string;
	updatedAt: number;
}

export interface SnippetPart {
	text: string;
	/** Whether this is the part the learner searched for. */
	match: boolean;
}

export interface SearchResult extends SessionSummary {
	snippet: SnippetPart[];
}

export type TranscriptBlock =
	| { kind: "text"; text: string }
	| { kind: "reasoning"; text: string }
	| {
			kind: "tool";
			id: string;
			label: string;
			/** What to show while it runs. Only a live reply has one. */
			runningLabel?: string;
			state: "running" | "done" | "failed";
			durationMs?: number;
	  };

export interface TranscriptMessage {
	id: string;
	role: "user" | "assistant";
	blocks: TranscriptBlock[];
	attachments?: AttachmentInfo[];
	notice?: string;
	failed?: boolean;
	/** How long the tutor worked before the reply's text started. */
	workedMs?: number;
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
