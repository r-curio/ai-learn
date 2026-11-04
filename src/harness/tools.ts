import type { AgentTool } from "@earendil-works/pi-agent-core";
import { z } from "zod";
import type { AttachmentStore } from "./attachments.ts";

const readAttachmentInput = z.object({
	id: z.string().describe("The attachment id from its <attachment> tag."),
	offset: z.number().int().min(0).optional().describe("Character offset to start from. Defaults to 0."),
	limit: z.number().int().min(1).max(100_000).optional().describe("Maximum characters to return."),
});

export function createTools(attachments: AttachmentStore): AgentTool<any>[] {
	return [
		{
			name: "read_attachment",
			label: "Reading attachment",
			description: "Read an attachment the learner uploaded in this session, including parts cut off in their message.",
			parameters: z.toJSONSchema(readAttachmentInput),
			execute: async (_id, params) => {
				const input = readAttachmentInput.parse(params);
				return { content: attachments.read(input.id, input.offset, input.limit), details: undefined };
			},
		},
	];
}
