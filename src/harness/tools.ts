import type { AgentMessage, AgentTool } from "@earendil-works/pi-agent-core";
import {
	createInitialSystemMessage,
	getCurrentTools,
	getToolStateChanges,
	toToolDeclaration,
	type SystemMessage,
} from "@earendil-works/pi-ai";
import { z } from "zod";
import { INLINE_TEXT_CHARS, type AttachmentStore } from "./attachments.ts";
import type { SearchService } from "./web/search-service.ts";
import { webLabels, webTools } from "./web/web-tools.ts";

const readAttachmentInput = z.object({
	id: z.string().describe("The attachment id from its <attachment> tag."),
	offset: z
		.number()
		.int()
		.min(0)
		.optional()
		.describe("Character offset to start from. Defaults to 0."),
	limit: z.number().int().min(1).max(100_000).optional().describe("Maximum characters to return."),
});

export const ASK_QUESTION = "ask_question";

export const askQuestionInput = z.strictObject({
	question: z.string().min(1).describe("The question to ask."),
	choices: z.array(z.string().min(1)).min(2).max(4).describe("The answers to choose from."),
});

export const QUIZ = "quiz";

/** The answer and explanation come before the learner sees anything, so the tutor can't grade generously after. */
export const quizInput = z
	.strictObject({
		question: z.string().min(1).describe("The question to ask."),
		choices: z
			.array(z.string().min(1))
			.min(2)
			.max(4)
			.describe("The answers to choose from. Each is a plain claim, with no reasoning in it."),
		explanation: z
			.string()
			.min(1)
			.describe("Why the right answer is right. The learner sees this after answering."),
		correctAnswer: z
			.number()
			.int()
			.min(0)
			.max(3)
			.describe("The position of the right choice, counting from 0."),
		role: z
			.enum(["predict", "check"])
			.describe("predict: a guess before you teach a step. check: whether a step landed."),
		planStep: z.string().min(1).optional().describe("The plan step this quiz belongs to."),
	})
	.refine((input) => input.correctAnswer < input.choices.length, {
		message: "correctAnswer must be the position of one of the choices.",
		path: ["correctAnswer"],
	});

/** The tools that ask the learner something and wait for their answer. */
export const isQuestionTool = (name: string) => name === ASK_QUESTION || name === QUIZ;

/** What the Activity trace calls a tool call, while it runs and once it's finished. */
export function toolLabels(
	name: string,
	args: unknown,
	attachmentName: (id: string) => string | undefined,
): { label: string; runningLabel: string } {
	if (isQuestionTool(name)) return { label: "Ask a question", runningLabel: "Asking a question" };
	const web = webLabels(name, args);
	if (web) return web;
	if (name !== "read_attachment") return { label: name, runningLabel: name };
	const id = (args as { id?: unknown } | undefined)?.id;
	const target = (typeof id === "string" && attachmentName(id)) || "attachment";
	return { label: `Read ${target}`, runningLabel: `Reading ${target}` };
}

// The run ends here and the learner's answer becomes the real result, so this is never saved.
const waitForLearner = async () => ({
	content: [{ type: "text" as const, text: "Waiting for the learner." }],
	details: undefined,
});

/** The tutor's tools. Without a connected search service, `web_search` isn't offered. */
export function createTools(attachments: AttachmentStore, search?: SearchService): AgentTool[] {
	return [
		{
			name: "read_attachment",
			label: "Read attachment",
			description:
				"Read an attachment the learner uploaded in this session, including parts cut off in their message.",
			parameters: z.toJSONSchema(readAttachmentInput),
			execute: async (_id, params) => {
				const input = readAttachmentInput.parse(params);
				return {
					content: attachments.read(input.id, input.offset, input.limit ?? INLINE_TEXT_CHARS),
					details: undefined,
				};
			},
		},
		{
			name: ASK_QUESTION,
			label: "Ask a question",
			description:
				"Show the learner a multiple-choice question and wait for their answer. They can pick a choice, write their own answer, or say they don't know. Unless they don't know, they say how sure they are from 0 to 100, and they can add their reasoning. The question has its own card, so don't repeat it or its choices in your text.",
			parameters: z.toJSONSchema(askQuestionInput),
			execute: waitForLearner,
		},
		{
			name: QUIZ,
			label: "Quiz",
			description:
				"Show the learner a multiple-choice question that has a right answer, and wait for their answer. Commit the right answer and an explanation now: the learner sees whether they were right, and your explanation, once they answer. They can also write their own answer, which you grade in your reply, or say they don't know. Use ask_question instead when there's no right answer. The question has its own card, so don't repeat it or its choices in your text.",
			parameters: z.toJSONSchema(quizInput),
			// A wrong `correctAnswer` fails here, so the tutor can fix it and nothing waits on a broken quiz.
			execute: async (_id, params) => {
				const input = quizInput.safeParse(params);
				if (!input.success) throw new Error(input.error.issues[0]?.message ?? "Invalid quiz.");
				return waitForLearner();
			},
		},
		...webTools(search),
	];
}

/** A session's first message: its prompt, and the tools every session starts with. It's rebuilt on each load. */
export function initialSystemMessage(
	prompt: string,
	attachments: AttachmentStore,
): SystemMessage[] {
	const message = createInitialSystemMessage(
		prompt,
		createTools(attachments).map(toToolDeclaration),
	);
	return message ? [message] : [];
}

/**
 * The message that tells the model its tools changed, shaped as Pi makes it, or nothing if they
 * didn't. The session saves it, so a reloaded chat sends the same history as the live one.
 */
export function toolChange(
	messages: readonly AgentMessage[],
	tools: AgentTool[],
): SystemMessage | undefined {
	const current = getCurrentTools(messages);
	const { toolsAdded, toolsRemoved } = getToolStateChanges(current, tools.map(toToolDeclaration));
	if (toolsAdded.length === 0 && toolsRemoved.length === 0) return undefined;
	return {
		role: "system",
		content: "",
		timestamp: Date.now(),
		...(toolsAdded.length > 0 ? { toolsAdded } : {}),
		...(toolsRemoved.length > 0 ? { toolsRemoved } : {}),
	};
}
