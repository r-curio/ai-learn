import type { VoiceModels } from "../../shared/protocol.ts";
import { failureFor, unreachable, type Recording } from "./voice-error.ts";

const LABEL = "Deepgram";
const BASE_URL = "https://api.deepgram.com/v1";
const DEFAULT_MODEL = "nova-3";

/** How long the model list is reused before asking again. */
const MODEL_LIST_TTL_MS = 10 * 60 * 1000;
let modelList: { at: number; models: string[] } | undefined;

/** Deepgram answers 403 when the account can't use that model, not for a bad key. */
const deepgramFailure = (status: number) => failureFor(status === 403 ? 404 : status, LABEL);

async function call(path: string, apiKey: string, init: RequestInit = {}): Promise<unknown> {
	const response = await fetch(`${BASE_URL}${path}`, {
		...init,
		headers: { ...init.headers, Authorization: `Token ${apiKey}` },
	}).catch(() => {
		throw unreachable(LABEL);
	});
	if (!response.ok) throw deepgramFailure(response.status);
	return response.json().catch(() => undefined);
}

/** Deepgram also lists retired and test models, so only the current families are offered. */
const CURRENT_FAMILY = /^(nova|whisper)-/;

/** The models that transcribe recordings, rather than only live audio, with the default first. */
export async function deepgramModels(apiKey: string): Promise<VoiceModels> {
	if (modelList && Date.now() - modelList.at < MODEL_LIST_TTL_MS)
		return { models: modelList.models, defaultModel: DEFAULT_MODEL };
	const body = (await call("/models", apiKey)) as { stt?: unknown } | undefined;
	if (!Array.isArray(body?.stt)) throw deepgramFailure(502);
	const found = (body.stt as { canonical_name?: unknown; batch?: unknown }[])
		.filter((model) => model.batch === true && typeof model.canonical_name === "string")
		.map((model) => model.canonical_name as string)
		.filter((name) => CURRENT_FAMILY.test(name));
	const models = [...new Set([DEFAULT_MODEL, ...found.sort()])];
	modelList = { at: Date.now(), models };
	return { models, defaultModel: DEFAULT_MODEL };
}

/** Send the recording as it is, and return Deepgram's punctuated text. */
export async function transcribeWithDeepgram(
	apiKey: string,
	{ audio, mimeType }: Recording,
	model?: string,
): Promise<string> {
	const query = new URLSearchParams({ model: model ?? DEFAULT_MODEL, smart_format: "true" });
	const body = (await call(`/listen?${query}`, apiKey, {
		method: "POST",
		headers: { "Content-Type": mimeType },
		body: new Blob([audio], { type: mimeType }),
	})) as { results?: { channels?: { alternatives?: { transcript?: unknown }[] }[] } } | undefined;
	const text = body?.results?.channels?.[0]?.alternatives?.[0]?.transcript;
	if (typeof text !== "string") throw deepgramFailure(502);
	return text.trim();
}
