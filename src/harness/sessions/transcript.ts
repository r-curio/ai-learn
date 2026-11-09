import type { AssistantMessage } from "@earendil-works/pi-ai";
import type {
	AttachmentInfo,
	ContextUsage,
	ModelRef,
	QuestionAnswer,
	TranscriptBlock,
	TranscriptMessage,
	UsageSummary,
} from "../../shared/protocol.ts";
import { keepCitations, stripCitations, type Citation } from "../../shared/citations.ts";
import { answerText, noticeFor } from "../../shared/protocol.ts";
import type { LogEntry } from "./log.ts";
import { askedIn, gradeOf, type QuizKey } from "./questions.ts";
import { toolLabels } from "../tools.ts";
import { isSearchLimit, SEARCH_LIMIT_LABEL } from "../web/web-tools.ts";

const INTERRUPTED_NOTICE = "The app closed before this reply finished.";

type ToolBlock = Extract<TranscriptBlock, { kind: "tool" }>;

/** Add one model step's reasoning, text, and tool calls. Redacted reasoning has no text to show. */
function addReplyParts(
	blocks: TranscriptBlock[],
	reply: AssistantMessage,
	toolBlocks: Map<string, ToolBlock>,
	attachmentInfo: (id: string) => AttachmentInfo | undefined,
	citationIsReal: (citation: Citation) => boolean,
	quizKeys: Map<string, QuizKey>,
): void {
	const asked = askedIn(reply);
	const question = asked?.question;
	if (asked?.key) quizKeys.set(asked.question.id, asked.key);
	for (const part of reply.content) {
		if (part.type === "text" && part.text) {
			blocks.push({ kind: "text", text: keepCitations(part.text, citationIsReal) });
		} else if (part.type === "thinking" && part.thinking.trim()) {
			blocks.push({ kind: "reasoning", text: part.thinking });
		} else if (part.type === "toolCall" && part.id === question?.id) {
			const text = keepCitations(question.text, citationIsReal);
			blocks.push({ kind: "question", ...question, text });
		} else if (part.type === "toolCall") {
			const { label } = toolLabels(part.name, part.arguments, (id) => attachmentInfo(id)?.name);
			const block: ToolBlock = { kind: "tool", id: part.id, label, state: "running" };
			blocks.push(block);
			toolBlocks.set(part.id, block);
		}
	}
}

/** A finished tool call. A search the guard stopped says so, in place of what it searched for. */
function settleTool(block: ToolBlock, result: { isError: boolean; content: { type: string }[] }) {
	block.state = result.isError ? "failed" : "done";
	if (isSearchLimit(result)) block.label = SEARCH_LIMIT_LABEL;
}

/** A learner's answer as they see it, using the choices from the reply that asked, and how a quiz went. */
function answerMessage(
	id: string,
	questionId: string,
	answer: QuestionAnswer,
	quizKeys: Map<string, QuizKey>,
	asked: TranscriptMessage | undefined,
): TranscriptMessage {
	const question = asked?.blocks.find(
		(block) => block.kind === "question" && block.id === questionId,
	);
	const choices = question?.kind === "question" ? question.choices : [];
	const key = quizKeys.get(questionId);
	return {
		id,
		role: "user",
		blocks: [{ kind: "text", text: answerText(choices, answer) }],
		...("confidence" in answer ? { confidence: answer.confidence } : {}),
		...(key ? { grade: { ...gradeOf(key, answer), choices } } : {}),
	};
}

/** Replies saved before `workedMs` was recorded estimate it, but only if there's a trace to head. */
function setWorkedTime(
	message: TranscriptMessage,
	saved: number | undefined,
	turn: { start: number; end: number },
): void {
	const hasTrace = message.blocks.some(
		(block) => block.kind !== "text" && block.kind !== "question",
	);
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
	/** A citation that fails this is left out, so the learner is never sent to a passage that isn't there. */
	citationIsReal: (citation: Citation) => boolean = () => true,
): TranscriptMessage[] {
	const messages: TranscriptMessage[] = [];
	let current: TranscriptMessage | undefined;
	let failedFrom: number | undefined;
	let toolBlocks = new Map<string, ToolBlock>();
	const keys = new Map<string, QuizKey>();
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

		// An answer sits between two parts of a turn, so the tutor's next words start a new reply.
		if (message.role === "toolResult" && entry.answer) {
			messages.push(answerMessage(`m${index}`, message.toolCallId, entry.answer, keys, current));
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
			addReplyParts(current.blocks, message, toolBlocks, attachmentInfo, citationIsReal, keys);
			turn.end = message.timestamp + (message.durationMs ?? 0);
			const ending = noticeFor(message.stopReason, message.errorMessage);
			if (ending) {
				current.notice = ending.notice;
				current.failed = ending.failed;
				if (ending.failed) failedFrom = start;
			}
		} else if (message.role === "toolResult") {
			const block = toolBlocks.get(message.toolCallId);
			if (block) settleTool(block, message);
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

/** Say the app stopped partway, on the unfinished reply or in place of one that never started. */
export function markInterrupted(messages: TranscriptMessage[], notice = INTERRUPTED_NOTICE): void {
	const tail = messages.at(-1);
	if (tail?.role === "assistant") tail.notice = notice;
	else messages.push({ id: "interrupted", role: "assistant", blocks: [], notice });
}

/** The words the learner can see in a chat. Attachments aren't read, so their contents aren't included. */
export function searchTextOf(entries: LogEntry[]): string {
	return buildTranscript(entries, () => undefined)
		.flatMap((message) => message.blocks)
		.flatMap((block) =>
			block.kind === "text" || block.kind === "question" ? [stripCitations(block.text)] : [],
		)
		.join("\n");
}

/** Everything sent to the model on one call, including what the provider served from its cache. */
const inputSize = ({ usage }: AssistantMessage) => usage.input + usage.cacheRead + usage.cacheWrite;

/** The chat's size so far. A failed or stopped call can report nothing, so it's skipped. */
export function contextOf(
	entries: LogEntry[],
	limitOf: (model: ModelRef) => number | undefined,
): ContextUsage | undefined {
	for (const entry of entries.toReversed()) {
		if (entry.type !== "message" || entry.message.role !== "assistant") continue;
		const tokens = inputSize(entry.message);
		if (tokens > 0) {
			const { provider, model: id } = entry.message;
			return { tokens, limit: limitOf({ provider, id }) };
		}
	}
	return undefined;
}

export function addUsage(total: UsageSummary, message: AssistantMessage): void {
	const { usage } = message;
	total.inputTokens += inputSize(message);
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
