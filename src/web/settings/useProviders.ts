import { useCallback } from "react";
import type { AddableProvider, EngineStatus } from "../../shared/protocol.ts";
import { removeProviderKey, saveProviderKey } from "../api.ts";

export type { AddableProvider };

export interface ConnectedRow extends AddableProvider {
	keySource: "saved" | "environment";
}

/** What the server says is connected. Each change refreshes it, so the model picker updates too. */
export function useProviders(status: EngineStatus | undefined, refresh: () => Promise<void>) {
	const connect = useCallback(
		async (id: string, key: string) => {
			await saveProviderKey(id, key);
			await refresh();
		},
		[refresh],
	);
	const disconnect = useCallback(
		(id: string) => {
			removeProviderKey(id)
				.then(refresh)
				.catch((cause: Error) => console.warn(`Couldn't remove that key: ${cause.message}`));
		},
		[refresh],
	);

	const connected: ConnectedRow[] = (status?.providers ?? []).map(
		({ id, label, models, keySource }) => ({ id, label, modelCount: models.length, keySource }),
	);
	return { connected, available: status?.addable ?? [], connect, disconnect };
}
