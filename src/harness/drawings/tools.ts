import type { AgentTool } from "@earendil-works/pi-agent-core";
import { z } from "zod";
import type { Drawing } from "../../shared/drawing.ts";
import { layOut, type DrawingDescription } from "./layout.ts";

export const DRAW = "draw";
export const PLAN = "plan";
const PLAN_ID = "plan";

const nodes = z
	.array(
		z.strictObject({
			id: z.string().min(1).describe("A short id that edges and groups refer to."),
			label: z.string().min(1).max(80).describe("The words in the box."),
		}),
	)
	.min(1);
const edges = z.array(
	z.strictObject({
		from: z.string().min(1),
		to: z.string().min(1),
		label: z.string().min(1).max(40).optional(),
	}),
);
const groups = z
	.array(
		z.strictObject({
			id: z.string().min(1),
			label: z.string().min(1).max(60),
			nodes: z.array(z.string().min(1)).min(1).describe("The ids of the nodes inside it."),
		}),
	)
	.optional();

const drawInput = z.strictObject({
	id: z
		.string()
		.regex(/^[a-z0-9-]{1,40}$/)
		.describe("Lowercase words joined by hyphens. Reuse an id to draw a new version of it."),
	title: z.string().min(1).max(80),
	nodes,
	edges: edges.describe("Arrows between nodes."),
	groups: groups.describe("Frames around nodes that belong together. A node is in one at most."),
});

const planInput = z.strictObject({
	title: z.string().min(1).max(80).describe("The goal, in a few words."),
	nodes: nodes.describe("The goal, and each idea needed to reach it."),
	edges: edges.describe('"Needed before" arrows, from an idea to what builds on it.'),
	groups: groups.describe("Frames around ideas that belong together. A node is in one at most."),
});

function drawingTool(
	name: string,
	label: string,
	description: string,
	schema: z.ZodType,
	describe: (params: unknown) => DrawingDescription,
): AgentTool {
	return {
		name,
		label,
		description,
		parameters: z.toJSONSchema(schema),
		execute: async (_id, params) => {
			const drawing = await layOut(describe(params));
			const text = `Drew "${drawing.title}" with ${drawing.boxes.length} boxes and ${drawing.arrows.length} arrows. The learner sees it in the chat.`;
			return { content: [{ type: "text", text }], details: drawing };
		},
	};
}

export function createDrawingTools(): AgentTool[] {
	return [
		drawingTool(
			DRAW,
			"Draw",
			"Draw a concept diagram the learner sees in the chat. Describe the boxes, arrows and groups, and the app lays them out, so give no positions. Draw again with the same id to replace it with a new version. Don't repeat the diagram in your text.",
			drawInput,
			(params) => {
				const input = drawInput.parse(params);
				return { ...input, kind: "diagram", groups: input.groups ?? [] };
			},
		),
		drawingTool(
			PLAN,
			"Plan",
			'Draw the lesson plan: the goal at the top, the ideas it needs below it, and foundations at the bottom, joined by "needed before" arrows. A chat has one plan, so calling this again replaces it with a new version. Don\'t repeat the plan in your text.',
			planInput,
			(params) => {
				const input = planInput.parse(params);
				return { ...input, id: PLAN_ID, kind: "plan", groups: input.groups ?? [] };
			},
		),
	];
}

export const isDrawingTool = (name: string) => name === DRAW || name === PLAN;

/** The drawing a successful `draw` or `plan` call saved with its result. */
export function drawingIn(result: {
	toolName: string;
	isError: boolean;
	details?: unknown;
}): Drawing | undefined {
	if (!isDrawingTool(result.toolName) || result.isError) return undefined;
	const drawing = result.details as Drawing | undefined;
	return drawing && Array.isArray(drawing.boxes) ? drawing : undefined;
}
