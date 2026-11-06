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
	streamFn: StreamFn;
	status(): Promise<EngineStatus>;
	/** What to run a learner's choice on, or nothing if that choice can't be used. */
	resolve(selection: ModelSelection): Promise<ResolvedModel | undefined>;
}

/** Every provider Pi knows. Which ones can be used depends on the credentials set up. */
export function createEngine(): Engine {
	return engineFromModels(builtinModels());
}
