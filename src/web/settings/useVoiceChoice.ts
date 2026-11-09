import { useEffect, useState } from "react";
import type { PreferencesChange, VoiceEngineOption } from "../../shared/protocol.ts";
import { getPreferences, savePreferences } from "../api.ts";

export const VOICE_OFF = "off";

interface VoiceChoice {
	voice?: string;
	voiceModel?: string;
}

/**
 * The saved voice engine and model. Nothing chosen, or an engine that's no longer connected, means
 * off. A change shows at once and goes back if it can't be saved.
 */
export function useVoiceChoice(engines: VoiceEngineOption[]) {
	const [chosen, setChosen] = useState<VoiceChoice>({});
	const [error, setError] = useState<string>();
	useEffect(() => {
		getPreferences()
			.then(({ voice, voiceModel }) => setChosen({ voice, voiceModel }))
			.catch((cause: Error) => setError(cause.message));
	}, []);

	const save = (next: VoiceChoice, change: PreferencesChange) => {
		const previous = chosen;
		setChosen(next);
		setError(undefined);
		savePreferences(change).catch((cause: Error) => {
			setChosen(previous);
			setError(cause.message);
		});
	};
	/** A new engine starts on its own default model. */
	const chooseEngine = (id: string) => {
		const voice = id === VOICE_OFF ? undefined : id;
		save({ voice }, { voice: voice ?? null, voiceModel: null });
	};
	const chooseModel = (voiceModel: string) => save({ ...chosen, voiceModel }, { voiceModel });

	const usable = engines.some(({ id, connected }) => id === chosen.voice && connected);
	return {
		engine: usable && chosen.voice ? chosen.voice : VOICE_OFF,
		model: chosen.voiceModel,
		chooseEngine,
		chooseModel,
		error,
	};
}
