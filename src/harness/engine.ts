import type { StreamFn } from "@earendil-works/pi-agent-core";
import { createModels, type Model } from "@earendil-works/pi-ai";
import { anthropicProvider } from "@earendil-works/pi-ai/providers/anthropic";
import type { EngineStatus } from "../shared/protocol.ts";

/** Everything the harness needs to talk to a model. Swap this to change provider. */
export interface Engine {
	model: Model<string>;
	streamFn: StreamFn;
	status(): EngineStatus;
}

export const DEFAULT_MODEL_ID = "claude-opus-5-5";

export function createClaudeEngine(
	modelId = process.env.AI_LEARN_MODEL ?? DEFAULT_MODEL_ID,
): Engine {
	const models = createModels();
	models.setProvider(anthropicProvider());
	const model = models.getModel("anthropic", modelId);
	if (!model) throw new Error(`Unknown Claude model: ${modelId}`);
	return {
		model: model,
		streamFn: models.streamSimple.bind(models),
		status: () =>
			process.env.ANTHROPIC_API_KEY
				? { ready: true, model: modelId }
				: { ready: false, model: modelId, reason: "ANTHROPIC_API_KEY is not set." },
	};
}
