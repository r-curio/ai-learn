import type { StreamFn, ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { AuthContext, Model } from "@earendil-works/pi-ai";
import { builtinModels } from "@earendil-works/pi-ai/providers/all";
import type { EngineStatus, ModelRef, ModelSelection, VoiceModels } from "../shared/protocol.ts";
import { engineFromModels } from "./model-catalog.ts";
import { ProviderKeyStore, type KeyCipher } from "./provider-keys.ts";
import type { Recording } from "./voice/voice-error.ts";
import type { SearchService } from "./web/search-service.ts";

export interface ResolvedModel {
	model: Model<string>;
	thinkingLevel: ThinkingLevel;
}

/** Everything the harness needs to talk to a model. Swap this to change provider. */
export interface Engine {
	streamFn: StreamFn;
	status(): Promise<EngineStatus>;
	/** What to run a learner's choice on, or nothing if that choice can't be used. */
	resolve(selection: ModelSelection): Promise<ResolvedModel | undefined>;
	/** A model's context window. It works without a key, so old chats can still be measured. */
	contextLimit(model: ModelRef): number | undefined;
	saveKey(providerId: string, key: string): Promise<void>;
	removeKey(providerId: string): Promise<void>;
	/** The models a voice engine from `status().voice` offers. Throws `VoiceError`. */
	voiceModels(engineId: string): Promise<VoiceModels>;
	/** Turn a recording into text with a voice engine, on its default model unless one is named. Throws `VoiceError`. */
	transcribe(engineId: string, recording: Recording, model?: string): Promise<string>;
	/** The web search service with a key, or nothing. Asked before each run, so a new key works on the next message. */
	searchService(): Promise<SearchService | undefined>;
}

export interface EngineOptions {
	dataDir: string;
	cipher?: KeyCipher;
	/** Where environment variables come from. Tests pass their own. */
	authContext?: AuthContext;
}

/** Every provider Pi knows. Which ones can be used depends on the credentials set up. */
export function createEngine({ dataDir, cipher, authContext }: EngineOptions): Engine {
	// Without the saved keys, this one shows what the environment alone provides.
	const environment = builtinModels({ authContext });
	const keys = new ProviderKeyStore(
		dataDir,
		cipher,
		async (id) => (await environment.getAuth(id).catch(() => undefined)) !== undefined,
	);
	const models = builtinModels({ authContext, credentials: keys });
	const env = authContext
		? (name: string) => authContext.env(name)
		: async (name: string) => process.env[name];
	return engineFromModels(models, { keys, environment, env });
}
