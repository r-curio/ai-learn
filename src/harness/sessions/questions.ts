import type { AgentOptions } from "@earendil-works/pi-agent-core";
import type { AssistantMessage, Message, ToolResultMessage } from "@earendil-works/pi-ai";
import type { Question, QuestionAnswer } from "../../shared/protocol.ts";
import { ASK_QUESTION, askQuestionInput } from "../tools.ts";
import { unresolvedToolCalls } from "./recovery.ts";

/** The question a finished reply asks. Only the first valid one counts, and later ones get an error. */
export function questionIn(reply: AssistantMessage): Question | undefined {
	if (reply.stopReason !== "toolUse") return undefined;
	for (const part of reply.content) {
		if (part.type !== "toolCall" || part.name !== ASK_QUESTION) continue;
		const input = askQuestionInput.safeParse(part.arguments);
		if (input.success)
			return { id: part.id, text: input.data.question, choices: input.data.choices };
	}
	return undefined;
}

export const questionHooks: Pick<AgentOptions, "beforeToolCall" | "finishTurn"> = {
	// A reply gets one question, so only one can ever be waiting.
	beforeToolCall: async ({ assistantMessage, toolCall }) =>
		toolCall.name === ASK_QUESTION && questionIn(assistantMessage)?.id !== toolCall.id
			? { block: true, reason: "Ask one question at a time." }
			: undefined,
	// Now the tutor waits for the learner, and the saved reply is what remembers that.
	finishTurn: async ({ message }) =>
		message.role === "assistant" && questionIn(message) ? { action: "end" } : undefined,
};

/** What Pi needs a tool to return, which stands in until the real answer. It's never saved. */
export const questionPlaceholder = (result: ToolResultMessage): boolean =>
	result.toolName === ASK_QUESTION && !result.isError;

/** A question is waiting when the latest reply asked it and it has no result. The log needs nothing more. */
export function pendingQuestionIn(messages: Message[]): Question | undefined {
	const reply = messages.findLast((message) => message.role === "assistant");
	const question = reply && questionIn(reply);
	return unresolvedToolCalls(messages).some((call) => call.id === question?.id)
		? question
		: undefined;
}

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
export function answerResult(question: Question, answer: QuestionAnswer): ToolResultMessage {
	return {
		role: "toolResult",
		toolCallId: question.id,
		toolName: ASK_QUESTION,
		content: [{ type: "text", text: answerLines(question, answer).join("\n") }],
		isError: false,
		timestamp: Date.now(),
	};
}
