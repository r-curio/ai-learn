import type { Models } from "@earendil-works/pi-ai";
import type { VoiceEngineOption, VoiceModels } from "../../shared/protocol.ts";
import { failureFor, unreachable, VoiceError, type Recording } from "./voice-error.ts";

const LABEL = "NVIDIA";
const TRANSCRIBE_URL = "https://grpc.nvcf.nvidia.com/v1/audio/transcriptions";
const FUNCTIONS_URL = "https://api.nvcf.nvidia.com/v2/nvcf/functions";

/**
 * The hosted models that answer a plain HTTP request, by the name NVIDIA lists them under. The
 * other Parakeet models only answer gRPC, which isn't used here.
 */
const MODELS: Record<string, string> = { "parakeet-ctc-1.1b-asr": "ai-parakeet-ctc-1_1b-asr" };
const DEFAULT_MODEL = "parakeet-ctc-1.1b-asr";

/** How long a function ID is reused before it's looked up again, since NVIDIA can change it. */
const FUNCTION_ID_TTL_MS = 10 * 60 * 1000;
const functionIds = new Map<string, { at: number; id: string }>();

const notAvailable = () => new VoiceError("This model isn't available from NVIDIA right now.", 409);

export async function nvidiaVoiceEngine(models: Models): Promise<VoiceEngineOption> {
	const auth = await models.getAuth("nvidia").catch(() => undefined);
	return {
		id: "nvidia",
		label: "NVIDIA Parakeet",
		connected: auth?.auth.apiKey !== undefined,
		wantsWav: true,
	};
}

async function nvidiaKey(models: Models): Promise<string> {
	const apiKey = (await models.getAuth("nvidia").catch(() => undefined))?.auth.apiKey;
	if (!apiKey) throw new VoiceError(`Add your ${LABEL} key in Settings to use voice.`, 409);
	return apiKey;
}

async function call(url: string, apiKey: string, init: RequestInit = {}): Promise<Response> {
	const response = await fetch(url, {
		...init,
		headers: { ...init.headers, Authorization: `Bearer ${apiKey}` },
	}).catch(() => {
		throw unreachable(LABEL);
	});
	if (response.status === 404) throw notAvailable();
	if (!response.ok) throw failureFor(response.status, LABEL);
	return response;
}

/** The current function ID for a model, looked up by its name among the active functions. */
async function functionIdFor(apiKey: string, model: string): Promise<string> {
	const name = MODELS[model];
	if (!name) throw notAvailable();
	const cached = functionIds.get(name);
	if (cached && Date.now() - cached.at < FUNCTION_ID_TTL_MS) return cached.id;
	const body = (await (await call(FUNCTIONS_URL, apiKey)).json().catch(() => undefined)) as
		{ functions?: { id?: unknown; name?: unknown; status?: unknown }[] } | undefined;
	if (!Array.isArray(body?.functions)) throw failureFor(502, LABEL);
	const found = body.functions.find((fn) => fn.name === name && fn.status === "ACTIVE");
	if (typeof found?.id !== "string") throw notAvailable();
	functionIds.set(name, { at: Date.now(), id: found.id });
	return found.id;
}

export async function nvidiaModels(models: Models): Promise<VoiceModels> {
	await nvidiaKey(models);
	return { models: Object.keys(MODELS), defaultModel: DEFAULT_MODEL };
}

/** Send a WAV recording to NVIDIA's hosted Parakeet and return its text. It can't decode WebM. */
export async function transcribeWithNvidia(
	models: Models,
	{ audio, mimeType }: Recording,
	model = DEFAULT_MODEL,
): Promise<string> {
	if (mimeType !== "audio/wav")
		throw new VoiceError("NVIDIA needs the recording as WAV. Reload the app and try again.", 400);
	const apiKey = await nvidiaKey(models);
	const functionId = await functionIdFor(apiKey, model);
	const form = new FormData();
	form.set("file", new Blob([audio], { type: mimeType }), "recording.wav");
	form.set("language", "en-US");
	try {
		const response = await call(TRANSCRIBE_URL, apiKey, {
			method: "POST",
			headers: { "function-id": functionId },
			body: form,
		});
		const body = (await response.json().catch(() => undefined)) as { text?: unknown } | undefined;
		if (typeof body?.text !== "string") throw failureFor(502, LABEL);
		return body.text.trim();
	} catch (error) {
		// The ID may have just changed, so the next try looks it up again.
		if (error instanceof VoiceError && error.status === 409) functionIds.delete(MODELS[model]!);
		throw error;
	}
}
