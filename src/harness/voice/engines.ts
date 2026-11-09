import type { Credential, Models } from "@earendil-works/pi-ai";
import type { VoiceEngineOption, VoiceModels } from "../../shared/protocol.ts";
import { deepgramModels, transcribeWithDeepgram } from "./deepgram.ts";
import { nvidiaModels, nvidiaVoiceEngine, transcribeWithNvidia } from "./nvidia.ts";
import { cloudVoiceEngines, cloudVoiceModels, transcribeInCloud } from "./openai-compatible.ts";
import { VoiceError, type Recording } from "./voice-error.ts";

/** Voice engines that aren't chat providers, so their key is added in Settings → Voice. */
const VOICE_ONLY: Record<string, { label: string; envVar: string }> = {
	deepgram: { label: "Deepgram", envVar: "DEEPGRAM_API_KEY" },
};

/** Where voice-only keys come from: the encrypted key file, or the environment. */
export interface VoiceKeySources {
	keys: { read(id: string): Promise<Credential | undefined> };
	env(name: string): Promise<string | undefined>;
}

export const isVoiceOnly = (id: string) => Object.hasOwn(VOICE_ONLY, id);

/** True when the environment sets this voice-only engine's key, which then wins (ADR 0009). */
export async function hasVoiceEnvironmentKey(sources: VoiceKeySources, id: string) {
	const engine = VOICE_ONLY[id];
	return engine !== undefined && Boolean(await sources.env(engine.envVar));
}

async function voiceOnlyKey(sources: VoiceKeySources, id: string) {
	const engine = VOICE_ONLY[id];
	if (!engine) return undefined;
	const fromEnvironment = await sources.env(engine.envVar);
	if (fromEnvironment) return { apiKey: fromEnvironment, keySource: "environment" as const };
	const saved = await sources.keys.read(id);
	return saved?.type === "api_key" && saved.key
		? { apiKey: saved.key, keySource: "saved" as const }
		: undefined;
}

/** Every voice engine, and whether each has a key. */
export async function voiceEngines(
	models: Models,
	sources: VoiceKeySources,
): Promise<VoiceEngineOption[]> {
	const voiceOnly = await Promise.all(
		Object.entries(VOICE_ONLY).map(async ([id, { label }]) => {
			const key = await voiceOnlyKey(sources, id);
			return { id, label, connected: key !== undefined, ownKey: true, keySource: key?.keySource };
		}),
	);
	return [...(await cloudVoiceEngines(models)), await nvidiaVoiceEngine(models), ...voiceOnly];
}

async function requireKey(sources: VoiceKeySources, id: string): Promise<string> {
	const key = await voiceOnlyKey(sources, id);
	if (!key)
		throw new VoiceError(`Add your ${VOICE_ONLY[id]?.label} key in Settings to use voice.`, 409);
	return key.apiKey;
}

export async function voiceModels(
	models: Models,
	sources: VoiceKeySources | undefined,
	id: string,
): Promise<VoiceModels> {
	if (sources && id === "deepgram") return deepgramModels(await requireKey(sources, id));
	if (id === "nvidia") return nvidiaModels(models);
	return cloudVoiceModels(models, id);
}

export async function transcribe(
	models: Models,
	sources: VoiceKeySources | undefined,
	id: string,
	recording: Recording,
	model?: string,
): Promise<string> {
	if (sources && id === "deepgram")
		return transcribeWithDeepgram(await requireKey(sources, id), recording, model);
	if (id === "nvidia") return transcribeWithNvidia(models, recording, model);
	return transcribeInCloud(models, id, recording, model);
}
