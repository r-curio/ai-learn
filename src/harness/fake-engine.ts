import {
	createModels,
	fauxAssistantMessage,
	fauxProvider,
	fauxText,
	fauxThinking,
	fauxToolCall,
	type FauxProviderHandle,
	type FauxResponseFactory,
	type FauxResponseStep,
} from "@earendil-works/pi-ai";
import type { Engine } from "./engine.ts";
import { engineFromModels } from "./model-catalog.ts";

const FAKE_INPUT: ("text" | "image")[] = ["text", "image"];
const FAKE_MODELS = [
	{ id: "fake-model", name: "Fake Model", reasoning: true, input: FAKE_INPUT },
	{ id: "fake-model-deep", name: "Fake Deep Model", reasoning: true, input: FAKE_INPUT },
];

/** A deterministic engine for tests: replies come from a fixed script. */
export function createScriptedEngine(
	responses: FauxResponseStep[],
	tokensPerSecond?: number,
): Engine & { faux: FauxProviderHandle } {
	const faux = fauxProvider({ models: FAKE_MODELS, tokensPerSecond });
	// One offers every level and one only the top two, so a switch has a level to change.
	const [model, deep] = faux.models;
	model.thinkingLevelMap = { xhigh: "xhigh", max: "max" };
	if (deep)
		deep.thinkingLevelMap = { low: null, medium: null, high: null, xhigh: "xhigh", max: "max" };
	const models = createModels();
	models.setProvider(faux.provider);
	faux.setResponses(responses);
	return { faux, ...engineFromModels(models) };
}

const FAKE_REASONING =
	"Working out what the learner is really asking. A short answer first, then an example should help, since it's easier to see than to describe.";

const LONG_PARAGRAPH =
	"This is a long **fake model** reply, so there's time to stop it or close the app part way through. It says the same thing a few times.";

/** Replies that force one state, so each can be tried by putting its word in a message. */
function createForcedReplies() {
	let failedLastTime = false;
	return (text: string) => {
		if (text.includes("fake:plain")) return fauxAssistantMessage("**Fake model** plain reply.");
		if (text.includes("fake:long"))
			return fauxAssistantMessage(Array(16).fill(LONG_PARAGRAPH).join("\n\n"));
		if (text.includes("fake:length"))
			return fauxAssistantMessage("This reply stops part way", { stopReason: "length" });
		if (text.includes("fake:tool-fail"))
			return fauxAssistantMessage(fauxToolCall("read_attachment", { id: "missing" }), {
				stopReason: "toolUse",
			});
		if (text.includes("fake:fail")) {
			// Every other attempt fails, so Retry gets a reply.
			failedLastTime = !failedLastTime;
			if (failedLastTime)
				return fauxAssistantMessage("This reply stops part way", {
					stopReason: "error",
					errorMessage: "The response failed.",
				});
		}
		return undefined;
	};
}

/** A free offline stand-in for trying the app without a key (AI_LEARN_FAKE_MODEL=1). */
export function createDemoEngine(): Engine {
	const forcedReply = createForcedReplies();
	const respond: FauxResponseFactory = (context) => {
		const last = context.messages.at(-1);
		if (last?.role === "toolResult")
			return fauxAssistantMessage("I read that attachment with a tool. **Fake model** reply.");
		const parts = last?.role === "user" && Array.isArray(last.content) ? last.content : [];
		const text = parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n");
		const forced = forcedReply(text);
		if (forced) return forced;
		const images = parts.filter((part) => part.type === "image").length;
		const id = text.match(/<attachment id="([^"]+)" name="[^"]*" kind="(?:text|pdf)"/)?.[1];
		if (id && /\bread\b/i.test(text))
			return fauxAssistantMessage(
				[fauxThinking(FAKE_REASONING), fauxToolCall("read_attachment", { id })],
				{
					stopReason: "toolUse",
				},
			);
		return fauxAssistantMessage([
			fauxThinking(FAKE_REASONING),
			fauxText(
				`**Fake model** reply. I received ${images} image(s) and ${text.length} characters of text.`,
			),
		]);
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
