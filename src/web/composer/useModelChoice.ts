import { useCallback, useEffect, useRef, useState } from "react";
import {
	EFFORTS,
	type Effort,
	type EngineStatus,
	type ModelOption,
	type ModelRef,
	type ModelSelection,
} from "../../shared/protocol.ts";
import { getPreferences, savePreferences } from "../api.ts";

export const EFFORT_LABELS: Record<Effort, string> = {
	low: "Low",
	medium: "Medium",
	high: "High",
	xhigh: "Extra high",
	max: "Max",
};

/** The allowed level nearest the one wanted. On a tie, the lower one, since it costs less. */
export function closestEffort(wanted: Effort, allowed: Effort[]): Effort | undefined {
	const distance = (effort: Effort) => Math.abs(EFFORTS.indexOf(effort) - EFFORTS.indexOf(wanted));
	return allowed.reduce<Effort | undefined>(
		(best, effort) => (best && distance(best) <= distance(effort) ? best : effort),
		undefined,
	);
}

function warnNotSaved(cause: Error) {
	console.warn(`Couldn't save the model choice: ${cause.message}`);
}

/**
 * The model and effort picked in the composer, remembered across launches. The learner's wanted
 * effort is kept apart from the one in use, so a trip through a model with no Medium still comes
 * back to Medium afterward. No model is picked for the learner: until they choose one, and again
 * if a saved model's key is gone, there's nothing to send with.
 */
export function useModelChoice(status: EngineStatus | undefined, focusMessage: () => void) {
	const [chosen, setChosen] = useState<ModelRef>();
	const [wantedEffort, setWantedEffort] = useState<Effort>("medium");
	const [pickerOpen, setPickerOpen] = useState(false);
	const openedBySend = useRef(false);

	useEffect(() => {
		getPreferences()
			.then((preferences) => {
				if (preferences.model) setChosen(preferences.model);
				if (preferences.effort) setWantedEffort(preferences.effort);
			})
			.catch(() => {
				// Without saved settings, the defaults still work.
			});
	}, []);

	const chooseModel = useCallback((model: ModelRef) => {
		setChosen(model);
		savePreferences({ model }).catch(warnNotSaved);
	}, []);

	const setEffort = useCallback((effort: Effort) => {
		setWantedEffort(effort);
		savePreferences({ effort }).catch(warnNotSaved);
	}, []);

	const openPickerForSend = useCallback(() => {
		openedBySend.current = true;
		setPickerOpen(true);
	}, []);

	/** After a send opened the picker, the next Enter should send, so go back to the message. */
	const onPickerCloseFocus = useCallback(
		(event: Event) => {
			if (!openedBySend.current) return;
			openedBySend.current = false;
			event.preventDefault();
			focusMessage();
		},
		[focusMessage],
	);

	const models = status?.providers.flatMap((provider) => provider.models) ?? [];
	const model: ModelOption | undefined = models.find(
		({ provider, id }) => provider === chosen?.provider && id === chosen.id,
	);
	const effort = model && closestEffort(wantedEffort, model.efforts);
	const selection: ModelSelection | undefined = model && {
		provider: model.provider,
		id: model.id,
		effort,
	};

	return {
		model,
		effort,
		selection,
		setEffort,
		chooseModel,
		pickerOpen,
		setPickerOpen,
		openPickerForSend,
		onPickerCloseFocus,
	};
}

export type ModelChoice = ReturnType<typeof useModelChoice>;
