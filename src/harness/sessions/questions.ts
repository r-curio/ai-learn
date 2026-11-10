import type { AgentMessage, AgentOptions } from "@earendil-works/pi-agent-core";
import type { AssistantMessage, Message, ToolResultMessage } from "@earendil-works/pi-ai";
import type { Question, QuestionAnswer, QuizGrade } from "../../shared/protocol.ts";
import { teaching } from "../prompts/phases.ts";
import { sentText } from "../prompts/send-to-user.ts";
import { ASK_QUESTION, askQuestionInput, isQuestionTool, QUIZ, quizInput } from "../tools.ts";
import { unresolvedToolCalls } from "./recovery.ts";

/** What a quiz committed before the learner saw it. It stays in the harness until they answer. */
export interface QuizKey {
	correctAnswer: number;
	explanation: string;
}

/** A question as the UI may see it, and for a quiz, the answer it must not see yet. */
export interface Asked {
	question: Question;
	key?: QuizKey;
}

function askedBy(part: AssistantMessage["content"][number]): Asked | undefined {
	if (part.type !== "toolCall") return undefined;
	if (part.name === ASK_QUESTION) {
		const input = askQuestionInput.safeParse(part.arguments);
		if (input.success)
			return { question: { id: part.id, text: input.data.question, choices: input.data.choices } };
	}
	if (part.name === QUIZ) {
		const input = quizInput.safeParse(part.arguments);
		if (!input.success) return undefined;
		const { question: text, choices, correctAnswer, explanation } = input.data;
		return { question: { id: part.id, text, choices }, key: { correctAnswer, explanation } };
	}
	return undefined;
}

/** The question a finished reply asks. Only the first valid one counts, and later ones get an error. */
export function askedIn(reply: AssistantMessage): Asked | undefined {
	if (reply.stopReason !== "toolUse") return undefined;
	for (const part of reply.content) {
		const asked = askedBy(part);
		if (asked) return asked;
	}
	return undefined;
}

export const questionIn = (reply: AssistantMessage): Question | undefined =>
	askedIn(reply)?.question;

/** What Pi needs a tool to return, which stands in until the real answer. It's never saved. */
export const questionPlaceholder = (result: ToolResultMessage): boolean =>
	isQuestionTool(result.toolName) && !result.isError;

const TEACH_FIRST =
	"Nothing has been taught yet: the learner can't see your thinking, and text before a tool call may be hidden. Send the teaching with send_to_user, then call quiz for the check again.";

/** At most this many refusals per turn, so a model that can't comply doesn't loop. */
const TEACH_FIRST_LIMIT = 2;

/** Whether a reply shows the learner something before this tool call: text, or a `send_to_user` message. */
const shownBefore = (reply: AssistantMessage, callId: string): boolean => {
	const at = reply.content.findIndex((part) => part.type === "toolCall" && part.id === callId);
	return reply.content
		.slice(0, at)
		.some((part) =>
			part.type === "text" ? part.text.trim() !== "" : sentText(part) !== undefined,
		);
};

const refusedThisTurn = (messages: readonly AgentMessage[]): number => {
	const turn = messages.slice(messages.findLastIndex((message) => message.role === "user") + 1);
	return turn.filter(
		(message) =>
			message.role === "toolResult" &&
			message.isError &&
			message.content.some((part) => part.type === "text" && part.text === TEACH_FIRST),
	).length;
};

/** A teacher's check must come after teaching the learner can see. */
const untaughtCheck = (
	reply: AssistantMessage,
	call: { id: string; name: string },
	args: unknown,
	messages: readonly AgentMessage[],
) =>
	call.name === QUIZ &&
	(args as { role?: unknown } | undefined)?.role === "check" &&
	teaching(messages) &&
	!shownBefore(reply, call.id) &&
	refusedThisTurn(messages) < TEACH_FIRST_LIMIT;

export const questionHooks: Pick<AgentOptions, "beforeToolCall" | "finishTurn"> = {
	// A reply gets one question, so only one can ever be waiting. An invalid one fails in its tool instead.
	beforeToolCall: async ({ assistantMessage, toolCall, args, context }) => {
		const asked = questionIn(assistantMessage)?.id;
		if (isQuestionTool(toolCall.name) && asked !== undefined && asked !== toolCall.id)
			return { block: true, reason: "Ask one question at a time." };
		if (untaughtCheck(assistantMessage, toolCall, args, context.messages))
			return { block: true, reason: TEACH_FIRST };
		return undefined;
	},
	// Now the tutor waits for the learner, and the saved reply is what remembers that.
	finishTurn: async ({ toolResults }) =>
		toolResults.some(questionPlaceholder) ? { action: "end" } : undefined,
};

/** The question waiting in a chat: the latest reply asked it and it has no result. The log needs nothing more. */
export function waitingIn(messages: Message[]): Asked | undefined {
	const reply = messages.findLast((message) => message.role === "assistant");
	const asked = reply && askedIn(reply);
	return unresolvedToolCalls(messages).some((call) => call.id === asked?.question.id)
		? asked
		: undefined;
}

export const pendingQuestionIn = (messages: Message[]): Question | undefined =>
	waitingIn(messages)?.question;

/** Whether an answer matches what the quiz committed. Words in the learner's own are graded by the tutor. */
export function gradeOf(key: QuizKey, answer: QuestionAnswer): QuizGrade {
	const verdict =
		answer.kind === "choice"
			? answer.choice === key.correctAnswer
				? "right"
				: "wrong"
			: answer.kind;
	return { verdict, correctAnswer: key.correctAnswer, explanation: key.explanation };
}

const VERDICT_LINES: Record<QuizGrade["verdict"], string> = {
	right: "That is the right answer.",
	wrong: "That is wrong.",
	own: "They answered in their own words, so grade it against your committed answer in your reply. They've been shown your explanation.",
	unknown: "They've been shown the right answer and your explanation.",
};

function answerLines(question: Question, answer: QuestionAnswer): string[] {
	const note = answer.reasoning?.trim();
	if (answer.kind === "unknown")
		return [
			"The learner said they don't know.",
			...(note ? [`What's confusing them: ${note}`] : []),
		];
	return [
		answer.kind === "choice"
			? `The learner chose: ${question.choices[answer.choice]}`
			: `The learner wrote their own answer: ${answer.text}`,
		`How sure they are, from 0 (just guessing) to 100 (certain): ${answer.confidence}`,
		...(note ? [`Their reasoning: ${note}`] : []),
	];
}

/** The tool result the model gets. It's the only place the model sees an answer. */
export function answerResult(asked: Asked, answer: QuestionAnswer): ToolResultMessage {
	const { question, key } = asked;
	const lines = answerLines(question, answer);
	if (key) lines.push(VERDICT_LINES[gradeOf(key, answer).verdict]);
	return {
		role: "toolResult",
		toolCallId: question.id,
		toolName: key ? QUIZ : ASK_QUESTION,
		content: [{ type: "text", text: lines.join("\n") }],
		isError: false,
		timestamp: Date.now(),
	};
}
