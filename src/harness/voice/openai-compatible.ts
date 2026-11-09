import type { Models } from "@earendil-works/pi-ai";
import type { VoiceEngineOption, VoiceModels } from "../../shared/protocol.ts";
import {
	failureFor,
	unreachable,
	VoiceError,
	VOICE_AUDIO_TYPES,
	type Recording,
} from "./voice-error.ts";

/** Cloud providers that turn speech into text with the same key as their chat models. */
const CLOUD_VOICE: Record<string, { label: string; defaultModel: string; baseUrl: string }> = {
	openai: {
		label: "OpenAI",
		defaultModel: "gpt-4o-mini-transcribe",
		baseUrl: "https://api.openai.com/v1",
	},
	groq: {
		label: "Groq",
		defaultModel: "whisper-large-v3-turbo",
		baseUrl: "https://api.groq.com/openai/v1",
	},
};

/** How long a provider's model list is reused before asking again. */
const MODEL_LIST_TTL_MS = 10 * 60 * 1000;
const modelLists = new Map<string, { at: number; models: string[] }>();

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

/** The engine and where to reach it with which key. Throws if it can't be used. */
async function connect(models: Models, engineId: string) {
	const engine = CLOUD_VOICE[engineId];
	if (!engine) throw new VoiceError("That voice engine isn't available.", 409);
	const auth = (await models.getAuth(engineId).catch(() => undefined))?.auth;
	if (!auth?.apiKey)
		throw new VoiceError(`Add your ${engine.label} key in Settings to use voice.`, 409);
	return { ...engine, url: auth.baseUrl ?? engine.baseUrl, apiKey: auth.apiKey };
}

/** Groq marks speech models. OpenAI doesn't, so its names decide, leaving out live and speaker-labelled ones. */
function isSpeechModel(model: {
	id?: unknown;
	output_modalities?: unknown;
}): model is { id: string } {
	if (typeof model.id !== "string") return false;
	if (Array.isArray(model.output_modalities))
		return model.output_modalities.includes("transcription");
	return /whisper|transcribe/i.test(model.id) && !/realtime|diarize|tts/i.test(model.id);
}

/** The speech models a cloud provider offers this key, with the default first. */
export async function cloudVoiceModels(models: Models, engineId: string): Promise<VoiceModels> {
	const engine = await connect(models, engineId);
	const cached = modelLists.get(engine.url);
	if (cached && Date.now() - cached.at < MODEL_LIST_TTL_MS)
		return { models: cached.models, defaultModel: engine.defaultModel };
	const response = await fetch(`${engine.url}/models`, {
		headers: { Authorization: `Bearer ${engine.apiKey}` },
	}).catch(() => {
		throw unreachable(engine.label);
	});
	if (!response.ok) throw failureFor(response.status, engine.label);
	const body = (await response.json().catch(() => undefined)) as { data?: unknown } | undefined;
	if (!Array.isArray(body?.data)) throw failureFor(502, engine.label);
	const found = (body.data as { id?: unknown }[]).filter(isSpeechModel).map(({ id }) => id);
	const ordered = [...new Set([engine.defaultModel, ...found.sort()])];
	modelLists.set(engine.url, { at: Date.now(), models: ordered });
	return { models: ordered, defaultModel: engine.defaultModel };
}

/** Send a recording to a cloud provider and return its text. */
export async function transcribeInCloud(
	models: Models,
	engineId: string,
	{ audio, mimeType }: Recording,
	model?: string,
): Promise<string> {
	const engine = await connect(models, engineId);

	const form = new FormData();
	const extension = VOICE_AUDIO_TYPES[mimeType] ?? "webm";
	form.set("file", new Blob([audio], { type: mimeType }), `recording.${extension}`);
	form.set("model", model ?? engine.defaultModel);
	form.set("response_format", "json");
	const response = await fetch(`${engine.url}/audio/transcriptions`, {
		method: "POST",
		headers: { Authorization: `Bearer ${engine.apiKey}` },
		body: form,
	}).catch(() => {
		throw unreachable(engine.label);
	});
	if (!response.ok) throw failureFor(response.status, engine.label);
	const body = (await response.json().catch(() => undefined)) as { text?: unknown } | undefined;
	if (typeof body?.text !== "string") throw failureFor(502, engine.label);
	return body.text.trim();
}
