import { getSupportedThinkingLevels, type Model, type Models } from "@earendil-works/pi-ai";
import type { Effort, ModelSelection, ModelOption, ProviderOption } from "../shared/protocol.ts";
import { EFFORTS } from "../shared/protocol.ts";
import type { Engine, ResolvedModel } from "./engine.ts";

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

/** Providers with a key or other credentials set up. A failed check counts as not connected. */
async function connectedProviders(models: Models): Promise<ProviderOption[]> {
	const providers = await Promise.all(
		models.getProviders().map(async (provider) => {
			const auth = await models.getAuth(provider.id).catch(() => undefined);
			if (!auth) return [];
			const options = models.getModels(provider.id).map(toOption);
			return options.length > 0 ? [{ id: provider.id, label: provider.name, models: options }] : [];
		}),
	);
	return providers.flat();
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

/** An engine over any set of Pi providers, so the fake model behaves like the real ones. */
export function engineFromModels(
	models: Models,
	model: Model<string>,
): Pick<Engine, "model" | "streamFn" | "status" | "resolve"> {
	return {
		model,
		streamFn: models.streamSimple.bind(models),
		resolve: (selection) => resolveSelection(models, selection),
		status: async () => {
			const providers = await connectedProviders(models);
			const defaultModel = { provider: model.provider, id: model.id };
			return providers.length > 0
				? { ready: true, defaultModel, providers }
				: {
						ready: false,
						defaultModel,
						providers,
						reason: "No provider key is set, such as ANTHROPIC_API_KEY.",
					};
		},
	};
}
