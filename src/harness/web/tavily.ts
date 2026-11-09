import type { SearchHit, SearchService } from "./search-service.ts";
import { WebToolError } from "./search-service.ts";

const SEARCH_URL = "https://api.tavily.com/search";
const MAX_RESULTS = 6;
const TIMEOUT_MS = 20_000;

/** Why Tavily said no. Its own reply isn't passed on, since it can repeat the request. */
function failureFor(status: number): WebToolError {
	if (status === 401 || status === 403)
		return new WebToolError(
			"Tavily rejected the search key. The learner can check it in Settings.",
		);
	if (status === 429 || status === 432 || status === 433)
		return new WebToolError("Tavily's search limit was reached. Try again later.");
	return new WebToolError(`Tavily couldn't run that search (status ${status}).`);
}

function hitsFrom(body: unknown): SearchHit[] {
	const results = (body as { results?: unknown } | undefined)?.results;
	if (!Array.isArray(results)) throw new WebToolError("Tavily sent back something unexpected.");
	return results.flatMap((result: { title?: unknown; url?: unknown; content?: unknown }) =>
		typeof result.url === "string"
			? [
					{
						title: typeof result.title === "string" ? result.title : result.url,
						url: result.url,
						snippet: typeof result.content === "string" ? result.content : "",
					},
				]
			: [],
	);
}

/** Tavily's search, with titles, links, and snippets. The key is only ever sent to Tavily. */
export function tavily(apiKey: string): SearchService {
	return {
		label: "Tavily",
		async search(query, signal) {
			const timeout = AbortSignal.timeout(TIMEOUT_MS);
			const response = await fetch(SEARCH_URL, {
				method: "POST",
				headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
				body: JSON.stringify({ query, max_results: MAX_RESULTS, search_depth: "basic" }),
				signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
			}).catch(() => {
				throw new WebToolError("Couldn't reach Tavily. The connection may be down.");
			});
			if (!response.ok) throw failureFor(response.status);
			return hitsFrom(await response.json().catch(() => undefined));
		},
	};
}
