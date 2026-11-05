import { useState } from "react";
import type { Effort, ModelOption, ProviderOption } from "../settings/useProviders.ts";

export const EFFORT_LABELS: Record<Effort, string> = {
	low: "Low",
	medium: "Medium",
	high: "High",
	xhigh: "Extra high",
	max: "Max",
};

export const ALL_EFFORTS = Object.keys(EFFORT_LABELS) as Effort[];

/** The allowed level nearest the one wanted. On a tie, the lower one, since it costs less. */
export function closestEffort(wanted: Effort, allowed: Effort[]): Effort | undefined {
	const distance = (effort: Effort) =>
		Math.abs(ALL_EFFORTS.indexOf(effort) - ALL_EFFORTS.indexOf(wanted));
	return allowed.reduce<Effort | undefined>(
		(best, effort) => (best && distance(best) <= distance(effort) ? best : effort),
		undefined,
	);
}

/**
 * The model and effort picked in the composer. The learner's wanted effort is kept apart from the
 * one in use, so a trip through Fable, which has no Medium, still comes back to Medium on Opus.
 * Nothing reads the choice yet: sending it with a message is the rest of issue #19.
 */
export function useModelChoice(providers: ProviderOption[]) {
	const [chosen, setChosen] = useState({ provider: "anthropic", id: "claude-opus-5-5" });
	const [wantedEffort, setEffort] = useState<Effort>("medium");

	const models = providers.flatMap((provider) => provider.models);
	const model: ModelOption | undefined =
		models.find(({ provider, id }) => provider === chosen.provider && id === chosen.id) ??
		models[0];

	return {
		model,
		effort: model && closestEffort(wantedEffort, model.efforts),
		setEffort,
		chooseModel: setChosen,
	};
}

export type ModelChoice = ReturnType<typeof useModelChoice>;
