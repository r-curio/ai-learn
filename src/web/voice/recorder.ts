/** A segment closes at the first quiet moment after this long, so words arrive about this often. */
const SEGMENT_MS = 2000;
/** A segment closes here even mid-word, so someone talking without a pause still sees words. */
const LONGEST_SEGMENT_MS = 6000;
/** How often the level is measured, which also paces the waveform. */
const TICK_MS = 80;
/** Below this loudness (RMS) counts as a pause. Speech is usually 0.02–0.3. */
const QUIET = 0.012;

/** Formats Chromium can record, in order of preference. Each is one the transcribe route accepts. */
const FORMATS = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];

export interface Recorder {
	/** Close the last segment and release the microphone. Resolves once that segment is handed over. */
	stop(): Promise<void>;
	/** Release the microphone and drop the last segment. */
	cancel(): void;
}

interface RecorderEvents {
	/** A finished piece of audio with sound in it, in the order it was spoken. */
	onSegment: (audio: Blob) => void;
	/** Loudness from 0 to 1, measured every tick. */
	onLevel: (level: number) => void;
}

/** Why the microphone couldn't start, worded for the learner. */
export class MicrophoneError extends Error {}

function privacySettings(): string {
	const platform = navigator.userAgent;
	if (platform.includes("Mac")) return "System Settings → Privacy & Security → Microphone";
	if (platform.includes("Windows")) return "Settings → Privacy & security → Microphone";
	return "your system's privacy or sound settings";
}

function microphoneProblem(error: unknown): MicrophoneError {
	const name = error instanceof DOMException ? error.name : "";
	if (name === "NotAllowedError" || name === "SecurityError")
		return new MicrophoneError(
			`ai-learn isn't allowed to use the microphone. Allow it in ${privacySettings()}, then try again.`,
		);
	if (name === "NotFoundError" || name === "OverconstrainedError")
		return new MicrophoneError("No microphone was found. Connect one and try again.");
	return new MicrophoneError(
		"The microphone couldn't start. Another app may be using it, so close that app and try again.",
	);
}

/** Ask for the microphone. Throws a `MicrophoneError` the learner can act on. */
export async function openMicrophone(): Promise<MediaStream> {
	if (!navigator.mediaDevices?.getUserMedia)
		throw new MicrophoneError("No microphone was found. Connect one and try again.");
	try {
		return await navigator.mediaDevices.getUserMedia({ audio: true });
	} catch (error) {
		throw microphoneProblem(error);
	}
}

/** Turn the microphone off, which also clears the system's recording indicator. */
export function releaseMicrophone(stream: MediaStream | undefined): void {
	for (const track of stream?.getTracks() ?? []) track.stop();
}

function loudness(analyser: AnalyserNode, samples: Float32Array<ArrayBuffer>): number {
	analyser.getFloatTimeDomainData(samples);
	let sum = 0;
	for (const sample of samples) sum += sample * sample;
	return Math.sqrt(sum / samples.length);
}

/**
 * Record in segments that are each a complete file. A recorder's timed slices can't be used
 * alone, since only the first carries the file header, so each segment gets its own recorder on
 * the same microphone. Segments end at pauses where possible, so words are rarely cut in half.
 */
export function startRecorder(stream: MediaStream, events: RecorderEvents): Recorder {
	const mimeType = FORMATS.find((format) => MediaRecorder.isTypeSupported(format)) ?? "";
	const audio = new AudioContext();
	const analyser = audio.createAnalyser();
	analyser.fftSize = 1024;
	audio.createMediaStreamSource(stream).connect(analyser);
	const samples = new Float32Array(analyser.fftSize);

	let current: { recorder: MediaRecorder; startedAt: number; heard: boolean };
	const begin = () => {
		const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
		const chunks: Blob[] = [];
		const segment = { recorder, startedAt: Date.now(), heard: false };
		recorder.ondataavailable = (event) => chunks.push(event.data);
		// A segment that stayed quiet isn't sent, which saves cost and stops engines inventing words.
		recorder.onstop = () => {
			if (segment.heard) events.onSegment(new Blob(chunks, { type: recorder.mimeType }));
		};
		recorder.start();
		current = segment;
	};
	begin();

	const tick = setInterval(() => {
		const level = loudness(analyser, samples);
		events.onLevel(Math.min(1, level / 0.2));
		if (level >= QUIET) current.heard = true;
		const age = Date.now() - current.startedAt;
		if ((age >= SEGMENT_MS && level < QUIET) || age >= LONGEST_SEGMENT_MS) {
			current.recorder.stop();
			begin();
		}
	}, TICK_MS);

	const release = () => {
		clearInterval(tick);
		releaseMicrophone(stream);
		void audio.close();
	};
	return {
		stop: () =>
			new Promise<void>((resolve) => {
				const { recorder } = current;
				recorder.addEventListener("stop", () => resolve(), { once: true });
				recorder.stop();
				release();
			}),
		cancel: () => {
			current.recorder.onstop = null;
			current.recorder.stop();
			release();
		},
	};
}
