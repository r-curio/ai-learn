import { useCallback, useState } from "react";

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export interface ModelOption {
	id: string;
	provider: string;
	label: string;
	contextWindow: number;
	/** US dollars per 1M tokens. */
	inputPrice: number;
	outputPrice: number;
	/** Empty when the model has no effort setting. */
	efforts: Effort[];
}

export interface ProviderOption {
	id: string;
	label: string;
	modelCount: number;
	models: ModelOption[];
}

const ALL: Effort[] = ["low", "medium", "high", "xhigh", "max"];

function provider(
	id: string,
	label: string,
	modelCount: number,
	models: Omit<ModelOption, "provider">[],
): ProviderOption {
	return { id, label, modelCount, models: models.map((model) => ({ ...model, provider: id })) };
}

function model(
	id: string,
	label: string,
	contextWindow: number,
	inputPrice: number,
	outputPrice: number,
	efforts: Effort[],
): Omit<ModelOption, "provider"> {
	return { id, label, contextWindow, inputPrice, outputPrice, efforts };
}

/**
 * A hand-written sample of Pi's catalog, with its real numbers. Issue #19 has the server send the
 * whole catalog, which can't be read from here because `src/web` may only import `shared`.
 */
const CATALOG: ProviderOption[] = [
	provider("anthropic", "Anthropic", 17, [
		model("claude-fable-5-1", "Claude Fable 5.1", 1_000_000, 10, 50, ["xhigh", "max"]),
		model("claude-opus-5-5", "Claude Opus 5.5", 1_000_000, 4, 20, ALL),
		model("claude-sonnet-5-5", "Claude Sonnet 5.5", 1_000_000, 2, 10, ALL),
		model("claude-haiku-5-5", "Claude Haiku 5.5", 1_000_000, 0.1, 0.5, ALL),
	]),
	provider("openai", "OpenAI", 45, [
		model("gpt-6.1-sol", "GPT-6.1 Sol", 272_000, 2, 10, ALL),
		model("gpt-6.1-terra", "GPT-6.1 Terra", 272_000, 1, 5, ALL),
	]),
	provider("google", "Google", 23, [
		model("gemini-4-argon", "Gemini 4 Argon", 1_048_576, 2, 10, ["low", "medium", "high"]),
		model("gemini-3.8-flash", "Gemini 3.8 Flash", 1_048_576, 0.75, 3.75, ["low", "medium", "high"]),
	]),
	provider("mistral", "Mistral", 34, [
		model("zai-glm-5-3", "GLM-5.3", 1_048_576, 1.4, 4.4, ["low", "high", "max"]),
		model("voxtral-small-latest", "Voxtral Small", 32_768, 0.1, 0.4, []),
	]),
	provider("openrouter", "OpenRouter", 485, [
		model("z-ai/glm-5.3-prime", "Z.ai: GLM 5.3 Prime", 1_000_000, 2.8, 8.8, ["low", "high", "max"]),
	]),
	provider("xai", "xAI", 4, [
		model("grok-4.7", "Grok 4.7", 500_000, 2, 6, ["low", "medium", "high", "xhigh"]),
	]),
	provider("deepseek", "DeepSeek", 2, [
		model("deepseek-v4-pro", "DeepSeek V4 Pro", 1_000_000, 1.32, 3.96, ["high", "max"]),
	]),
	provider("groq", "Groq", 7, [
		model("qwen/qwen3.8-27b", "Qwen3.8 27B", 131_072, 0.8, 4, ["low", "medium", "high"]),
	]),
];

/**
 * Which providers are connected. This only lives in memory, and the key is thrown away: storing it
 * and checking it with the provider is still to be built, as ADR 0009 describes.
 */
export function useProviders() {
	const [connectedIds, setConnectedIds] = useState(["anthropic", "openai"]);

	const connect = useCallback((id: string) => {
		setConnectedIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
	}, []);
	const disconnect = useCallback((id: string) => {
		setConnectedIds((ids) => ids.filter((other) => other !== id));
	}, []);

	return {
		connected: CATALOG.filter(({ id }) => connectedIds.includes(id)),
		available: CATALOG.filter(({ id }) => !connectedIds.includes(id)),
		connect,
		disconnect,
	};
}
