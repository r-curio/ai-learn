import {
	createModels,
	fauxAssistantMessage,
	fauxProvider,
	fauxToolCall,
	type FauxProviderHandle,
	type FauxResponseFactory,
	type FauxResponseStep,
} from "@earendil-works/pi-ai";
import type { Engine } from "./engine.ts";

const FAKE_MODEL = { id: "fake-model", input: ["text", "image"] as ("text" | "image")[] };

/** A deterministic engine for tests: replies come from a fixed script. */
export function createScriptedEngine(
	responses: FauxResponseStep[],
	tokensPerSecond?: number,
): Engine & { faux: FauxProviderHandle } {
	const faux = fauxProvider({ models: [FAKE_MODEL], tokensPerSecond });
	const models = createModels();
	models.setProvider(faux.provider);
	faux.setResponses(responses);
	return {
		faux,
		model: faux.getModel(),
		streamFn: models.streamSimple.bind(models),
		status: () => ({ ready: true, model: FAKE_MODEL.id }),
	};
}

/** A free offline stand-in for trying the app without a key (AI_LEARN_FAKE_MODEL=1). */
export function createDemoEngine(): Engine {
	const respond: FauxResponseFactory = (context) => {
		const last = context.messages.at(-1);
		if (last?.role === "toolResult")
			return fauxAssistantMessage("I read that attachment with a tool. **Fake model** reply.");
		const parts = last?.role === "user" && Array.isArray(last.content) ? last.content : [];
		const text = parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n");
		const images = parts.filter((part) => part.type === "image").length;
		const id = text.match(/<attachment id="([^"]+)" name="[^"]*" kind="(?:text|pdf)"/)?.[1];
		if (id && /\bread\b/i.test(text))
			return fauxAssistantMessage(fauxToolCall("read_attachment", { id }), {
				stopReason: "toolUse",
			});
		return fauxAssistantMessage(
			`**Fake model** reply. I received ${images} image(s) and ${text.length} characters of text.`,
		);
	};
	const engine = createScriptedEngine([], 60);
	return {
		...engine,
		streamFn: (model, context, options) => {
			engine.faux.appendResponses([respond]);
			return engine.streamFn(model, context, options);
		},
	};
}
