/** The audio formats the page can record, which every voice engine accepts. */
export const VOICE_AUDIO_TYPES: Record<string, string> = {
	"audio/webm": "webm",
	"audio/ogg": "ogg",
	"audio/wav": "wav",
	"audio/mp4": "mp4",
	"audio/mpeg": "mp3",
};

/** The cloud providers' upload limit. */
export const MAX_VOICE_BYTES = 25 * 1024 * 1024;

export interface Recording {
	audio: Uint8Array<ArrayBuffer>;
	/** One of `VOICE_AUDIO_TYPES`. */
	mimeType: string;
}

/** A transcription that couldn't be done, with a reason that's safe to show the learner. */
export class VoiceError extends Error {
	constructor(
		message: string,
		readonly status: 400 | 409 | 502 | 503,
	) {
		super(message);
	}
}

/** Why the provider said no. Its own reply isn't passed on, since it can repeat the request. */
export function failureFor(status: number, label: string): VoiceError {
	if (status === 401 || status === 403)
		return new VoiceError(`${label} rejected the key. Check it in Settings.`, 502);
	if (status === 404)
		return new VoiceError(
			`That model isn't available from ${label}. Choose another in Settings.`,
			409,
		);
	if (status === 413) return new VoiceError("That recording is too long to transcribe.", 400);
	if (status === 402 || status === 429)
		return new VoiceError(`${label} is busy or the account is out of credit. Try again soon.`, 503);
	return new VoiceError(`${label} couldn't transcribe that recording.`, 502);
}

/** A request that never reached the provider. */
export const unreachable = (label: string) =>
	new VoiceError(`Couldn't reach ${label}. Check your connection.`, 503);
