import type { Models } from "@earendil-works/pi-ai";
import type { VoiceEngineOption } from "../shared/protocol.ts";

/** Cloud providers that turn speech into text with the same key as their chat models. */
const CLOUD_VOICE: Record<string, { label: string; model: string; baseUrl: string }> = {
	openai: {
		label: "OpenAI",
		model: "gpt-4o-mini-transcribe",
		baseUrl: "https://api.openai.com/v1",
	},
	groq: {
		label: "Groq",
		model: "whisper-large-v3-turbo",
		baseUrl: "https://api.groq.com/openai/v1",
	},
};

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

const isConnected = async (models: Models, id: string) =>
	(await models.getAuth(id).catch(() => undefined))?.auth.apiKey !== undefined;

export async function cloudVoiceEngines(models: Models): Promise<VoiceEngineOption[]> {
	return Promise.all(
		Object.entries(CLOUD_VOICE).map(async ([id, { label }]) => ({
			id,
			label,
			connected: await isConnected(models, id),
		})),
	);
}

/** Why the provider said no. Its own reply isn't passed on, since it can repeat the request. */
function failureFor(status: number, label: string): VoiceError {
	if (status === 401 || status === 403)
		return new VoiceError(`${label} rejected the key. Check it in Settings.`, 502);
	if (status === 413) return new VoiceError("That recording is too long to transcribe.", 400);
	if (status === 429)
		return new VoiceError(`${label} is busy or the account is out of credit. Try again soon.`, 503);
	return new VoiceError(`${label} couldn't transcribe that recording.`, 502);
}

/** Send a recording to a cloud provider and return its text. */
export async function transcribeInCloud(
	models: Models,
	engineId: string,
	{ audio, mimeType }: Recording,
): Promise<string> {
	const engine = CLOUD_VOICE[engineId];
	if (!engine) throw new VoiceError("That voice engine isn't available.", 409);
	const auth = (await models.getAuth(engineId).catch(() => undefined))?.auth;
	if (!auth?.apiKey)
		throw new VoiceError(`Add a ${engine.label} key in Settings to use voice.`, 409);

	const form = new FormData();
	const extension = VOICE_AUDIO_TYPES[mimeType] ?? "webm";
	form.set("file", new Blob([audio], { type: mimeType }), `recording.${extension}`);
	form.set("model", engine.model);
	form.set("response_format", "json");
	const response = await fetch(`${auth.baseUrl ?? engine.baseUrl}/audio/transcriptions`, {
		method: "POST",
		headers: { Authorization: `Bearer ${auth.apiKey}` },
		body: form,
	}).catch(() => {
		throw new VoiceError(`Couldn't reach ${engine.label}. Check your connection.`, 503);
	});
	if (!response.ok) throw failureFor(response.status, engine.label);
	const body = (await response.json().catch(() => undefined)) as { text?: unknown } | undefined;
	if (typeof body?.text !== "string") throw failureFor(502, engine.label);
	return body.text.trim();
}
