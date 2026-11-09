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
import { ASK_QUESTION } from "./tools.ts";
import { VoiceError } from "./voice/voice-error.ts";

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
		const cite = text.match(/fake:cite (\d+) ([^\n]+)/);
		if (cite) {
			const id = text.match(/<attachment id="([^"]+)" name="[^"]*" kind="pdf"/)?.[1];
			const tag = `<cite attachment="${id}" page="${cite[1]}">${cite[2]}</cite>`;
			return fauxAssistantMessage(
				`The model compares each query with every key. ${tag} Want to try it?`,
			);
		}
		if (text.includes("fake:ask-long"))
			return fauxAssistantMessage(
				[
					fauxText("A longer one this time."),
					fauxToolCall(ASK_QUESTION, {
						question: LONG_PARAGRAPH,
						choices: [LONG_PARAGRAPH, "The query", LONG_PARAGRAPH, LONG_PARAGRAPH],
					}),
				],
				{ stopReason: "toolUse" },
			);
		if (text.includes("fake:ask"))
			return fauxAssistantMessage(
				[
					fauxText("Before we do, a quick check."),
					fauxToolCall(ASK_QUESTION, {
						question: 'In "the bank of the river", which vector says what "bank" is looking for?',
						choices: ["The key", "The query", "The value", "Its position in the sentence"],
					}),
				],
				{ stopReason: "toolUse" },
			);
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

const FAKE_VOICE = { id: "fake-voice", label: "Fake voice", connected: true };
const FAKE_DEFAULT_MODEL = "fake-speech-fast";
const FAKE_VOICE_MODELS = [FAKE_DEFAULT_MODEL, "fake-speech-accurate"];
const FAKE_SPEECH = "So the query is what the word is looking for.";

/** A free offline stand-in for trying the app without a key (AI_LEARN_FAKE_MODEL=1). */
export function createDemoEngine(): Engine {
	const forcedReply = createForcedReplies();
	const respond: FauxResponseFactory = (context) => {
		const last = context.messages.at(-1);
		if (last?.role === "toolResult" && last.toolName === ASK_QUESTION)
			return fauxAssistantMessage("Thanks for answering. **Fake model** reply.");
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
		status: async () => ({ ...(await engine.status()), voice: [FAKE_VOICE] }),
		voiceModels: async (engineId) => {
			if (engineId !== FAKE_VOICE.id)
				throw new VoiceError("That voice engine isn't available.", 409);
			return { models: FAKE_VOICE_MODELS, defaultModel: FAKE_DEFAULT_MODEL };
		},
		transcribe: async (engineId, _recording, model) => {
			if (engineId !== FAKE_VOICE.id)
				throw new VoiceError("That voice engine isn't available.", 409);
			if (model !== undefined && !FAKE_VOICE_MODELS.includes(model))
				throw new VoiceError(
					"That model isn't available from Fake voice. Choose another in Settings.",
					409,
				);
			return FAKE_SPEECH;
		},
		streamFn: (model, context, options) => {
			engine.faux.appendResponses([respond]);
			return engine.streamFn(model, context, options);
		},
	};
}
