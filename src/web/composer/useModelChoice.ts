import { useState } from "react";

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export interface ModelOption {
	id: string;
	label: string;
	efforts: Effort[];
}

export const EFFORT_LABELS: Record<Effort, string> = {
	low: "Low",
	medium: "Medium",
	high: "High",
	xhigh: "Extra high",
	max: "Max",
};

const ALL_EFFORTS = Object.keys(EFFORT_LABELS) as Effort[];

/**
 * Written by hand for now, and nothing reads the choice yet. Issue #19 has the server list these
 * in `GET /api/status`, and the efforts below come from Pi's `thinkingLevelMap` for each model.
 */
export const MODELS: ModelOption[] = [
	{ id: "claude-fable-5-1", label: "Claude Fable 5.1", efforts: ["xhigh", "max"] },
	{ id: "claude-opus-5-5", label: "Claude Opus 5.5", efforts: ALL_EFFORTS },
	{ id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", efforts: ALL_EFFORTS },
	{ id: "claude-haiku-5-5", label: "Claude Haiku 5.5", efforts: ALL_EFFORTS },
];

/** The allowed level nearest the one wanted. On a tie, the lower one, since it costs less. */
function closestEffort(wanted: Effort, allowed: Effort[]): Effort {
	const distance = (effort: Effort) =>
		Math.abs(ALL_EFFORTS.indexOf(effort) - ALL_EFFORTS.indexOf(wanted));
	return allowed.reduce((best, effort) => (distance(effort) < distance(best) ? effort : best));
}

/**
 * The model and effort picked in the composer. The learner's wanted effort is kept apart from the
 * one in use, so a trip through Fable, which has no Medium, still comes back to Medium on Opus.
 */
export function useModelChoice() {
	const [model, setModel] = useState(MODELS[1]!);
	const [wantedEffort, setEffort] = useState<Effort>("medium");

	return {
		model,
		effort: closestEffort(wantedEffort, model.efforts),
		setEffort,
		chooseModel: (id: string) => {
			const next = MODELS.find((option) => option.id === id);
			if (next) setModel(next);
		},
	};
}

export type ModelChoice = ReturnType<typeof useModelChoice>;
