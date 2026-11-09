import type { Credential } from "@earendil-works/pi-ai";
import type { SearchServiceOption } from "../../shared/protocol.ts";
import type { SearchService } from "./search-service.ts";
import { tavily } from "./tavily.ts";

/** Search services need their own key, which is added in Settings → Web search. */
const SERVICES: Record<
	string,
	{ label: string; envVar: string; create: (key: string) => SearchService }
> = {
	tavily: { label: "Tavily", envVar: "TAVILY_API_KEY", create: tavily },
};

/** Where search keys come from: the encrypted key file, or the environment. */
export interface SearchKeySources {
	keys: { read(id: string): Promise<Credential | undefined> };
	env(name: string): Promise<string | undefined>;
}

export const isSearchService = (id: string) => Object.hasOwn(SERVICES, id);

/** True when the environment sets this service's key, which then wins (ADR 0009). */
export async function hasSearchEnvironmentKey(sources: SearchKeySources, id: string) {
	const service = SERVICES[id];
	return service !== undefined && Boolean(await sources.env(service.envVar));
}

async function serviceKey(sources: SearchKeySources, id: string) {
	const service = SERVICES[id];
	if (!service) return undefined;
	const fromEnvironment = await sources.env(service.envVar);
	if (fromEnvironment) return { apiKey: fromEnvironment, keySource: "environment" as const };
	const saved = await sources.keys.read(id);
	return saved?.type === "api_key" && saved.key
		? { apiKey: saved.key, keySource: "saved" as const }
		: undefined;
}

/** Every search service, and whether each has a key. */
export function searchServices(sources: SearchKeySources): Promise<SearchServiceOption[]> {
	return Promise.all(
		Object.entries(SERVICES).map(async ([id, { label }]) => {
			const key = await serviceKey(sources, id);
			return { id, label, connected: key !== undefined, keySource: key?.keySource };
		}),
	);
}

/** The first service with a key, or nothing, in which case the tutor isn't offered web_search. */
export async function connectedSearchService(
	sources: SearchKeySources,
): Promise<SearchService | undefined> {
	for (const [id, service] of Object.entries(SERVICES)) {
		const key = await serviceKey(sources, id);
		if (key) return service.create(key.apiKey);
	}
	return undefined;
}
