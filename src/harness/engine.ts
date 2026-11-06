import type { StreamFn, ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { AuthContext, Model } from "@earendil-works/pi-ai";
import { builtinModels } from "@earendil-works/pi-ai/providers/all";
import type { EngineStatus, ModelRef, ModelSelection } from "../shared/protocol.ts";
import { engineFromModels } from "./model-catalog.ts";
import { ProviderKeyStore, type KeyCipher } from "./provider-keys.ts";

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
	return engineFromModels(models, { keys, environment });
}
