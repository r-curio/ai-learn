import type { AgentTool } from "@earendil-works/pi-agent-core";
import { z } from "zod";

export const FINISH_PROBE = "finish_probe";

const thread = z.strictObject({
	name: z.string().min(1).describe("A piece of prior knowledge the goal needs."),
	holds: z.string().describe("What the learner reliably understands on this thread."),
	edge: z.string().describe("Exactly where their understanding ends."),
	misconceptions: z.array(z.string().min(1)).describe("Wrong ideas found on this thread, if any."),
	startAt: z.string().min(1).describe("Where teaching should start on this thread."),
	measured: z
		.boolean()
		.describe("false when the learner skipped the probe before this thread had an edge."),
});

/** The probe's result. It stays in the call's arguments, which the teacher reads in the history. */
export const finishProbeInput = z.strictObject({
	goal: z
		.string()
		.min(1)
		.describe("What the learner wants to understand, concrete enough to plan."),
	overview: z
		.boolean()
		.optional()
		.describe(
			"true when they don't know the subject well enough to say, so the lesson opens with an overview.",
		),
	threads: z
		.array(thread)
		.describe("The prior knowledge the goal depends on, one entry per thread."),
});

/** Ends the probe. A successful call switches the session to the teacher from the next run. */
export const finishProbeTool: AgentTool = {
	name: FINISH_PROBE,
	label: "Finish the probe",
	description:
		"Save what the probe measured: the learner's goal and, for each thread of prior knowledge, where their understanding ends. Call it once, when the goal is concrete and every thread has an edge, or earlier if the learner wants to skip. Then write one short closing sentence and end your turn.",
	parameters: z.toJSONSchema(finishProbeInput),
	// An invalid result fails here, so the tutor can fix it and the session stays with the prober.
	execute: async (_id, params) => {
		const input = finishProbeInput.safeParse(params);
		if (!input.success) throw new Error(input.error.issues[0]?.message ?? "Invalid probe result.");
		return {
			content: [
				{
					type: "text",
					text: "The probe is saved. You teach from the learner's next message. Write one short closing sentence now and end your turn.",
				},
			],
			details: undefined,
		};
	},
};
