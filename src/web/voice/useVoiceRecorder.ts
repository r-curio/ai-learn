import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { VoiceEngineOption } from "../../shared/protocol.ts";
import { getPreferences, transcribe } from "../api.ts";
import { openMicrophone, startRecorder, type Recorder } from "./recorder.ts";

/** How many recent levels the waveform shows. */
const BARS = 5;
const silence = () => Array<number>(BARS).fill(0);

export type VoicePhase = "idle" | "starting" | "recording" | "finishing";

/** Something the learner should know about voice. `settings` means Settings → Voice can fix it. */
export interface VoiceProblem {
	message: string;
	settings?: boolean;
}

/** Why voice can't be used with the saved choice, or nothing if it can. */
async function setupProblem(engines: VoiceEngineOption[]): Promise<VoiceProblem | undefined> {
	const { voice } = await getPreferences();
	const engine = engines.find(({ id }) => id === voice);
	if (!engine)
		return { message: "Voice isn't set up. Choose how speech becomes text.", settings: true };
	if (!engine.connected)
		return { message: `Add your ${engine.label} key to use voice.`, settings: true };
	return undefined;
}

/**
 * Transcribes segments one at a time, in the order they were spoken. Each recording gets a new
 * run id, and words from an older run are dropped.
 */
function useTranscriptionQueue(onWords: (text: string) => void) {
	const run = useRef(0);
	const queue = useRef<Promise<void>>(Promise.resolve());
	const wordsTarget = useRef(onWords);
	useEffect(() => {
		wordsTarget.current = onWords;
	});
	// Stable, so a recording isn't cancelled just because the page drew again.
	return useMemo(
		() => ({
			/** Start a new run, which drops anything still coming from earlier ones. */
			begin: () => ++run.current,
			isCurrent: (id: number) => id === run.current,
			enqueue: (id: number, audio: Blob, onFailure: (message: string) => void) => {
				queue.current = queue.current.then(async () => {
					if (id !== run.current) return;
					try {
						const text = (await transcribe(audio)).trim();
						if (text && id === run.current) wordsTarget.current(text);
					} catch (error) {
						if (id === run.current) onFailure((error as Error).message);
					}
				});
			},
			drained: () => queue.current,
		}),
		[],
	);
}

/**
 * Records from the microphone and hands over the words of each segment as soon as they're
 * transcribed. It never sends anything to the tutor. A failure stops the recording and keeps the
 * words already handed over.
 */
export function useVoiceRecorder(engines: VoiceEngineOption[], onWords: (text: string) => void) {
	const [phase, setPhase] = useState<VoicePhase>("idle");
	const [problem, setProblem] = useState<VoiceProblem>();
	const [startedAt, setStartedAt] = useState(0);
	const [levels, setLevels] = useState(silence);
	const recorder = useRef<{ recorder: Recorder; id: number }>(undefined);
	const { begin, isCurrent, enqueue, drained } = useTranscriptionQueue(onWords);

	const cancel = useCallback(() => {
		begin();
		recorder.current?.recorder.cancel();
		recorder.current = undefined;
		setPhase("idle");
	}, [begin]);
	useEffect(() => cancel, [cancel]);

	const fail = (message: string) => {
		cancel();
		setProblem({ message });
	};

	async function start() {
		if (phase !== "idle") return;
		const id = begin();
		setProblem(undefined);
		setPhase("starting");
		const current = () => isCurrent(id);
		try {
			const found = await setupProblem(engines);
			const stream = found ? undefined : await openMicrophone();
			if (!current()) {
				for (const track of stream?.getTracks() ?? []) track.stop();
				return;
			}
			if (!stream) {
				setPhase("idle");
				setProblem(found);
				return;
			}
			setLevels(silence());
			const started = startRecorder(stream, {
				onSegment: (audio) => enqueue(id, audio, fail),
				onLevel: (level) => setLevels((previous) => [...previous.slice(1), level]),
			});
			recorder.current = { recorder: started, id };
			setStartedAt(Date.now());
			setPhase("recording");
		} catch (error) {
			// The microphone and the server word their own errors for the learner.
			if (current()) fail((error as Error).message);
		}
	}

	/** Stop recording, then wait for the last words before the box can be sent. */
	async function stop() {
		const active = recorder.current;
		if (phase !== "recording" || !active) return;
		recorder.current = undefined;
		setPhase("finishing");
		await active.recorder.stop();
		await drained();
		if (isCurrent(active.id)) setPhase("idle");
	}

	return {
		phase,
		/** Recording, or still waiting for its last words. The message can't be sent meanwhile. */
		busy: phase !== "idle",
		startedAt,
		levels,
		problem,
		start,
		stop,
		cancel,
		dismiss: () => setProblem(undefined),
	};
}

export type VoiceRecorder = ReturnType<typeof useVoiceRecorder>;
