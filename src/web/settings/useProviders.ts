import { useCallback, useState } from "react";
import type { EngineStatus } from "../../shared/protocol.ts";

export interface ProviderRow {
	id: string;
	label: string;
	modelCount: number;
}

/** A hand-written sample of what Pi offers, until saving keys makes these usable. */
const KNOWN_PROVIDERS: ProviderRow[] = [
	{ id: "anthropic", label: "Anthropic", modelCount: 17 },
	{ id: "openai", label: "OpenAI", modelCount: 45 },
	{ id: "google", label: "Google", modelCount: 23 },
	{ id: "mistral", label: "Mistral", modelCount: 34 },
	{ id: "openrouter", label: "OpenRouter", modelCount: 485 },
	{ id: "xai", label: "xAI", modelCount: 4 },
	{ id: "deepseek", label: "DeepSeek", modelCount: 2 },
	{ id: "groq", label: "Groq", modelCount: 7 },
];

/**
 * Starts from the providers the server really has keys for. Changes here only last until the
 * screen closes and don't reach the model picker, and a typed key is thrown away: storing it is
 * still to be built, as ADR 0009 describes.
 */
export function useProviders(status: EngineStatus | undefined) {
	const [added, setAdded] = useState<string[]>([]);
	const [removed, setRemoved] = useState<string[]>([]);

	const fromServer: ProviderRow[] = (status?.providers ?? []).map(({ id, label, models }) => ({
		id,
		label,
		modelCount: models.length,
	}));
	const known = [
		...fromServer,
		...KNOWN_PROVIDERS.filter(({ id }) => !fromServer.some((row) => row.id === id)),
	];
	const isConnected = ({ id }: ProviderRow) =>
		!removed.includes(id) && (added.includes(id) || fromServer.some((row) => row.id === id));

	const connect = useCallback((id: string) => {
		setAdded((ids) => (ids.includes(id) ? ids : [...ids, id]));
		setRemoved((ids) => ids.filter((other) => other !== id));
	}, []);
	const disconnect = useCallback((id: string) => {
		setRemoved((ids) => (ids.includes(id) ? ids : [...ids, id]));
		setAdded((ids) => ids.filter((other) => other !== id));
	}, []);

	return {
		connected: known.filter(isConnected),
		available: known.filter((row) => !isConnected(row)),
		connect,
		disconnect,
	};
}
