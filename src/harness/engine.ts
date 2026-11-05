import type { StreamFn, ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { Model } from "@earendil-works/pi-ai";
import { builtinModels } from "@earendil-works/pi-ai/providers/all";
import type { EngineStatus, ModelSelection } from "../shared/protocol.ts";
import { engineFromModels } from "./model-catalog.ts";

export interface ResolvedModel {
	model: Model<string>;
	thinkingLevel: ThinkingLevel;
}

/** Everything the harness needs to talk to a model. Swap this to change provider. */
export interface Engine {
	/** Used until a learner's message names a model. */
	model: Model<string>;
	streamFn: StreamFn;
	status(): Promise<EngineStatus>;
	/** What to run a learner's choice on, or nothing if that choice can't be used. */
	resolve(selection: ModelSelection): Promise<ResolvedModel | undefined>;
}

export const DEFAULT_MODEL_ID = "claude-opus-5-5";

export function createClaudeEngine(
	modelId = process.env.AI_LEARN_MODEL ?? DEFAULT_MODEL_ID,
): Engine {
	const models = builtinModels();
	const model = models.getModel("anthropic", modelId);
	if (!model) throw new Error(`Unknown Claude model: ${modelId}`);
	return engineFromModels(models, model);
}
