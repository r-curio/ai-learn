import { getSupportedThinkingLevels, type Model, type Models } from "@earendil-works/pi-ai";
import type {
	AddableProvider,
	Effort,
	EngineStatus,
	ModelOption,
	ModelSelection,
	ProviderOption,
} from "../shared/protocol.ts";
import { EFFORTS } from "../shared/protocol.ts";
import type { Engine, ResolvedModel } from "./engine.ts";
import { ProviderKeyError, type ProviderKeyStore } from "./provider-keys.ts";

/** How an engine's Pi providers get their keys. The fake model has neither. */
export interface KeySources {
	keys: ProviderKeyStore;
	/** The same providers, without the saved keys. */
	environment: Models;
}

const NO_FAKE_KEYS = "The fake model doesn't use keys.";

/** Pi's lower levels, like "off" and "minimal", aren't offered, so they never reach a learner. */
function effortsOf(model: Model<string>): Effort[] {
	const supported: string[] = getSupportedThinkingLevels(model);
	return EFFORTS.filter((effort) => supported.includes(effort));
}

function toOption(model: Model<string>): ModelOption {
	return {
		id: model.id,
		provider: model.provider,
		label: model.name,
		contextWindow: model.contextWindow,
		inputPrice: model.cost.input,
		outputPrice: model.cost.output,
		efforts: effortsOf(model),
	};
}

const isConfigured = async (models: Models, id: string) =>
	(await models.getAuth(id).catch(() => undefined)) !== undefined;

/** Which providers can be used now, and which could be with a key. A failed check counts as no. */
async function readCatalog(models: Models, sources?: KeySources) {
	const rows = await Promise.all(
		models.getProviders().map(async (provider) => {
			const options = models.getModels(provider.id).map(toOption);
			if (options.length === 0) return {};
			const row = { id: provider.id, label: provider.name };
			if (await isConfigured(models, provider.id)) {
				const saved =
					sources !== undefined && !(await isConfigured(sources.environment, provider.id));
				const connected: ProviderOption = {
					...row,
					models: options,
					keySource: saved ? "saved" : "environment",
				};
				return { connected };
			}
			if (!sources || !provider.auth.apiKey?.login) return {};
			const addable: AddableProvider = { ...row, modelCount: options.length };
			return { addable };
		}),
	);
	return {
		providers: rows.flatMap(({ connected }) => (connected ? [connected] : [])),
		addable: rows.flatMap(({ addable }) => (addable ? [addable] : [])),
	};
}

/** The model and level to use, or nothing if the provider isn't connected or the level isn't offered. */
async function resolveSelection(
	models: Models,
	{ provider, id, effort }: ModelSelection,
): Promise<ResolvedModel | undefined> {
	const model = models.getModel(provider, id);
	if (!model || !(await models.getAuth(provider).catch(() => undefined))) return undefined;
	const efforts = effortsOf(model);
	if (efforts.length === 0) return { model, thinkingLevel: "off" };
	return effort && efforts.includes(effort) ? { model, thinkingLevel: effort } : undefined;
}

function notReadyReason(keysUnavailable: string | undefined): string {
	return keysUnavailable === undefined
		? "No provider is connected yet. Add a key in Settings to start."
		: "No provider key is set, such as ANTHROPIC_API_KEY. Add it to .env.local in the project folder, then restart the app.";
}

async function readStatus(models: Models, sources?: KeySources): Promise<EngineStatus> {
	const catalog = await readCatalog(models, sources);
	const keysUnavailable = sources ? sources.keys.unavailableReason() : NO_FAKE_KEYS;
	return {
		ready: catalog.providers.length > 0,
		...catalog,
		keysUnavailable,
		...(catalog.providers.length > 0 ? {} : { reason: notReadyReason(keysUnavailable) }),
	};
}

async function saveKey(models: Models, sources: KeySources | undefined, id: string, key: string) {
	const reason = sources ? sources.keys.unavailableReason() : NO_FAKE_KEYS;
	if (!sources || reason) throw new ProviderKeyError(reason ?? NO_FAKE_KEYS, 503);
	if (!models.getProvider(id)?.auth.apiKey?.login)
		throw new ProviderKeyError("That provider can't use a saved key.", 400);
	if (await isConfigured(sources.environment, id))
		throw new ProviderKeyError("This provider's key already comes from the environment.", 409);
	await sources.keys.save(id, key);
}

/** An engine over any set of Pi providers, so the fake model behaves like the real ones. */
export function engineFromModels(models: Models, sources?: KeySources): Engine {
	return {
		streamFn: models.streamSimple.bind(models),
		resolve: (selection) => resolveSelection(models, selection),
		status: () => readStatus(models, sources),
		saveKey: (id, key) => saveKey(models, sources, id, key),
		removeKey: async (id) => {
			await sources?.keys.remove(id);
		},
	};
}
