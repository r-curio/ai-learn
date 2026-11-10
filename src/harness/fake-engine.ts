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
	type Message,
} from "@earendil-works/pi-ai";
import type { Engine } from "./engine.ts";
import { engineFromModels } from "./model-catalog.ts";
import { DRAW, isDrawingTool, PLAN } from "./drawings/tools.ts";
import { TITLE_PROMPT, writeTitle } from "./title.ts";
import { ASK_QUESTION, isQuestionTool, QUIZ } from "./tools.ts";
import { VoiceError } from "./voice/voice-error.ts";
import type { SearchService } from "./web/search-service.ts";
import { WEB_SEARCH } from "./web/web-tools.ts";

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
	// A title call would take the next scripted reply, so tests that want one set their own.
	return { faux, ...engineFromModels(models), writeTitle: async () => undefined };
}

const FAKE_REASONING =
	"Working out what the learner is really asking. A short answer first, then an example should help, since it's easier to see than to describe.";

const LONG_PARAGRAPH =
	"This is a long **fake model** reply, so there's time to stop it or close the app part way through. It says the same thing a few times.";

const MATHS_REPLY = [
	"For a right triangle with legs $a$ and $b$, the hypotenuse $c$ satisfies $a^2 + b^2 = c^2$.",
	"The quadratic formula solves $ax^2 + bx + c = 0$:",
	"$$\nx = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}\n$$",
	"> [!IMPORTANT]\n> The discriminant $b^2 - 4ac$ tells you how many real roots there are.",
	"And a sum to finish: $$\\sum_{k=1}^{n} k = \\frac{n(n+1)}{2}$$",
].join("\n\n");

/** Replies with maths, including one cut off part way through a formula. */
function mathsReply(text: string) {
	if (text.includes("fake:maths-cut"))
		return fauxAssistantMessage("The roots are $$\nx = \\frac{-b \\pm \\sqrt{b^2", {
			stopReason: "length",
		});
	if (text.includes("fake:ask-maths"))
		return fauxAssistantMessage(
			fauxToolCall(ASK_QUESTION, {
				question: "If $x^2 - 5x + 6 = 0$, what are the roots? $$\\Delta = b^2 - 4ac$$",
				choices: ["2 and 3", "-2 and -3", "1 and 6", "There are none"],
			}),
			{ stopReason: "toolUse" },
		);
	if (text.includes("fake:maths")) return fauxAssistantMessage(MATHS_REPLY);
	return undefined;
}

/** A predict quiz whose right answer is B, so either verdict can be tried. */
const fakeQuiz = () =>
	fauxAssistantMessage(
		[
			fauxText("Guess first."),
			fauxToolCall(QUIZ, {
				question: 'In "the bank of the river", which vector says what "bank" is looking for?',
				choices: ["The key", "The query", "The value", "Its position in the sentence"],
				explanation: "The query is what a word is looking for. Keys are what other words offer.",
				correctAnswer: 1,
				role: "predict",
			}),
		],
		{ stopReason: "toolUse" },
	);

const FAKE_PLAN = {
	title: "Understand attention",
	nodes: [
		{ id: "vectors", label: "Words as vectors" },
		{ id: "dot", label: "Dot products measure similarity" },
		{ id: "softmax", label: "Softmax turns scores into weights" },
		{ id: "qkv", label: "Queries, keys and values" },
		{ id: "attention", label: "Attention" },
	],
	edges: [
		{ from: "vectors", to: "dot" },
		{ from: "dot", to: "qkv" },
		{ from: "softmax", to: "attention" },
		{ from: "qkv", to: "attention" },
	],
	groups: [{ id: "maths", label: "The maths", nodes: ["dot", "softmax"] }],
};

const FAKE_DIAGRAM = {
	id: "attention-flow",
	title: "How one word attends",
	nodes: [
		{ id: "word", label: "The word's vector" },
		{ id: "query", label: "Query" },
		{ id: "keys", label: "Every word's key" },
		{ id: "scores", label: "Scores" },
		{ id: "values", label: "Weighted values" },
	],
	edges: [
		{ from: "word", to: "query", label: "times W_Q" },
		{ from: "query", to: "scores", label: "compared" },
		{ from: "keys", to: "scores", label: "dot product" },
		{ from: "scores", to: "values", label: "softmax" },
	],
};

/** `fake:plan` draws the lesson plan, and `fake:draw` a diagram. An edit gets its first change read back. */
function drawingReply(text: string) {
	const change = text.match(/<diagram-edit[^>]*>\n[^\n]*\n- ([^\n]+)/)?.[1];
	if (change) return fauxAssistantMessage(`I see your edit: ${change}. **Fake model** reply.`);
	const [intro, name, args] = text.includes("fake:plan")
		? ["Here's where we're headed.", PLAN, FAKE_PLAN]
		: ["Here's how the parts connect.", DRAW, FAKE_DIAGRAM];
	if (!text.includes("fake:plan") && !text.includes("fake:draw")) return undefined;
	return fauxAssistantMessage([fauxText(intro), fauxToolCall(name, args)], {
		stopReason: "toolUse",
	});
}

/** Replies that force one state, so each can be tried by putting its word in a message. */
function createForcedReplies() {
	let failedLastTime = false;
	return (text: string) => {
		const maths = mathsReply(text);
		if (maths) return maths;
		const cite = text.match(/fake:cite (\d+) ([^\n]+)/);
		if (cite) {
			const id = text.match(/<attachment id="([^"]+)" name="[^"]*" kind="pdf"/)?.[1];
			const tag = `<cite attachment="${id}" page="${cite[1]}">${cite[2]}</cite>`;
			return fauxAssistantMessage(
				`The model compares each query with every key. ${tag} Want to try it?`,
			);
		}
		if (text.includes("fake:quiz")) return fakeQuiz();
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
		if (text.includes("fake:search")) return fakeSearchCall();
		const drawing = drawingReply(text);
		if (drawing) return drawing;
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

const fakeSearchCall = () =>
	fauxAssistantMessage(
		[
			fauxThinking(FAKE_REASONING),
			fauxToolCall(WEB_SEARCH, { query: "attention is all you need" }),
		],
		{ stopReason: "toolUse" },
	);
const FAKE_SEARCH_ANSWER =
	"I searched the web. The paper is [Attention Is All You Need](https://arxiv.org/abs/1706.03762). **Fake model** reply.";
const FAKE_SEARCH_OPTION = { id: "fake-search", label: "Fake search", connected: true };

/** Offline search results, so the search tools can be tried for free. */
const FAKE_SEARCH: SearchService = {
	label: "Fake search",
	search: async (query) => [
		{
			title: "Attention Is All You Need",
			url: "https://arxiv.org/abs/1706.03762",
			snippet: `A fake result for "${query}". The transformer paper, from 2017.`,
		},
	],
};

const FAKE_VOICE = { id: "fake-voice", label: "Fake voice", connected: true };
const FAKE_DEFAULT_MODEL = "fake-speech-fast";
const FAKE_VOICE_MODELS = [FAKE_DEFAULT_MODEL, "fake-speech-accurate"];
const FAKE_SPEECH = "So the query is what the word is looking for.";

/** What the fake tutor says once a tool has finished. */
function afterTool(toolName: string): string {
	if (isQuestionTool(toolName)) return "Thanks for answering. **Fake model** reply.";
	if (toolName === WEB_SEARCH) return FAKE_SEARCH_ANSWER;
	if (isDrawingTool(toolName)) return "Ask about any box. **Fake model** reply.";
	return "I read that attachment with a tool. **Fake model** reply.";
}

/** The first three words the learner wrote, or a failure for `fake:title-fail`. */
function fakeTitle(request: Message | undefined) {
	const text = typeof request?.content === "string" ? request.content : "";
	if (text.includes("fake:title-fail"))
		return fauxAssistantMessage("", { stopReason: "error", errorMessage: "Title call failed." });
	const words = text
		.match(/<learner>\n([^\n]*)/)?.[1]
		?.split(/\s+/)
		.slice(0, 3)
		.join(" ");
	return fauxAssistantMessage(`Fake title: ${words || "a file"}`);
}

/** A free offline stand-in for trying the app without a key (AI_LEARN_FAKE_MODEL=1). */
export function createDemoEngine(): Engine {
	const forcedReply = createForcedReplies();
	const respond: FauxResponseFactory = (context) => {
		const last = context.messages.at(-1);
		if (context.messages[0]?.content === TITLE_PROMPT) return fakeTitle(last);
		if (last?.role === "toolResult") return fauxAssistantMessage(afterTool(last.toolName));
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
	const streamFn: Engine["streamFn"] = (model, context, options) => {
		engine.faux.appendResponses([respond]);
		return engine.streamFn(model, context, options);
	};
	return {
		...engine,
		status: async () => ({
			...(await engine.status()),
			voice: [FAKE_VOICE],
			search: [FAKE_SEARCH_OPTION],
		}),
		searchService: async () => FAKE_SEARCH,
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
		streamFn,
		writeTitle: (model, source) => writeTitle(streamFn, model, source),
	};
}
