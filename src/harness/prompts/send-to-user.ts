import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import { z } from "zod";

export const SEND_TO_USER = "send_to_user";

const sendToUserInput = z.strictObject({
	message: z
		.string()
		.regex(/\S/, "The message is empty.")
		.describe("Exactly what the learner should read. Markdown, LaTeX and citations work."),
});

/**
 * Opus 5.5 returns longer text written before a tool call as a hidden progress note, so a Learning
 * chat's teaching goes through this tool instead. Tool inputs are never summarized, and the
 * transcript shows the message as the tutor's own words.
 */
export const sendToUserTool: AgentTool = {
	name: SEND_TO_USER,
	label: "Send to the learner",
	description:
		"Show the learner a message exactly as written. Use it for everything they should read: explanations, teaching, feedback, corrections and recaps, and always for text that comes before a question in the same reply. Ordinary reply text written before a tool call may be turned into a hidden note the learner never sees. Put the question itself in quiz or ask_question, after this call. This doesn't end your turn.",
	parameters: z.toJSONSchema(sendToUserInput),
	execute: async (_id, params) => {
		const input = sendToUserInput.safeParse(params);
		if (!input.success) throw new Error(input.error.issues[0]?.message ?? "Invalid message.");
		return { content: [{ type: "text", text: "Shown to the learner." }], details: undefined };
	},
};

/** The message a `send_to_user` call shows, or nothing for any other part of a reply. */
export function sentText(part: AssistantMessage["content"][number]): string | undefined {
	if (part.type !== "toolCall" || part.name !== SEND_TO_USER) return undefined;
	const message = (part.arguments as { message?: unknown }).message;
	return typeof message === "string" && /\S/.test(message) ? message : undefined;
}
