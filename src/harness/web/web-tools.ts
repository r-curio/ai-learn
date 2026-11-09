import type { AgentOptions, AgentTool, BeforeToolCallResult } from "@earendil-works/pi-agent-core";
import type { Message } from "@earendil-works/pi-ai";
import { z } from "zod";
import { readPage } from "./read-page.ts";
import type { SearchHit, SearchService } from "./search-service.ts";

export const WEB_SEARCH = "web_search";
export const READ_PAGE = "read_page";

/** The most searches one run can make. The tutor searches until it's confident, so this only stops a loop. */
export const SEARCH_LIMIT = 25;
/** The start of the guard's reason. Saved chats are recognised by it, so it must never change. */
const SEARCH_LIMIT_MARK = "Stopped: this reply already ran ";
export const SEARCH_LIMIT_REASON = `${SEARCH_LIMIT_MARK}${SEARCH_LIMIT} searches, the most one reply can run. Answer with what you've found, and say what you couldn't check.`;
export const SEARCH_LIMIT_LABEL = `Stopped after ${SEARCH_LIMIT} searches`;
export const SEARCH_LIMIT_NOTICE = `Stopped after ${SEARCH_LIMIT} searches in one reply. Retry to get an answer from what was found.`;
/** About 5,000 tokens. Pages are long, and the tutor rarely needs all of one. */
export const PAGE_CHARS = 20_000;

const webSearchInput = z.strictObject({
	query: z.string().min(1).max(400).describe("What to search the web for."),
});
const readPageInput = z.strictObject({
	url: z.string().min(1).max(2048).describe("The http or https address of the page."),
	offset: z
		.number()
		.int()
		.min(0)
		.optional()
		.describe(
			"Character offset to start from, to read past where the last call stopped. Defaults to 0.",
		),
});

const attribute = (value: string) =>
	value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Content from the web can't close its own wrapper and pose as the app. */
const neutralize = (text: string, tag: string) => text.replaceAll(`</${tag}`, `<\\/${tag}`);

export function searchResultsText(query: string, hits: SearchHit[]): string {
	const lines = hits.map(
		(hit, index) => `${index + 1}. ${hit.title}\n${hit.url}\n${hit.snippet.trim()}`,
	);
	const body = lines.length > 0 ? lines.join("\n\n") : "No results.";
	return `<search_results query="${attribute(query)}">\n${neutralize(body, "search_results")}\n</search_results>`;
}

/** One window of a page's text. A note says where it stopped, so the tutor can ask for the next part. */
export function webPageText(
	page: { url: string; title: string; text: string },
	offset = 0,
): string {
	const total = page.text.length;
	const end = Math.min(offset + PAGE_CHARS, total);
	const shown = page.text.slice(offset, end);
	const note =
		offset >= total && total > 0
			? `\n[The page has only ${total} characters.]`
			: end < total
				? `\n[Showing characters ${offset}–${end} of ${total}. Call read_page with offset ${end} for more.]`
				: offset > 0
					? `\n[End of page. Showed characters ${offset}–${end} of ${total}.]`
					: "";
	const open = `<web_page url="${attribute(page.url)}" title="${attribute(page.title)}">`;
	return `${open}\n${neutralize(shown, "web_page")}${note}\n</web_page>`;
}

const text = (value: string) => ({
	content: [{ type: "text" as const, text: value }],
	details: undefined,
});

/** `read_page` needs no key. `web_search` is only offered when a search service has one. */
export function webTools(search: SearchService | undefined): AgentTool[] {
	const readTool: AgentTool = {
		name: READ_PAGE,
		label: "Read page",
		description:
			"Read a public web page and get its main text, with its title and final address. Long pages come in parts: call again with the offset the note gives to read on.",
		parameters: z.toJSONSchema(readPageInput),
		execute: async (_id, params, signal) => {
			const { url, offset } = readPageInput.parse(params);
			return text(webPageText(await readPage(url, signal), offset));
		},
	};
	if (!search) return [readTool];
	const searchTool: AgentTool = {
		name: WEB_SEARCH,
		label: "Search the web",
		description:
			"Search the web and get titles, links, and short snippets. Use read_page to read a result in full.",
		parameters: z.toJSONSchema(webSearchInput),
		execute: async (_id, params, signal) => {
			const { query } = webSearchInput.parse(params);
			return text(searchResultsText(query, await search.search(query, signal)));
		},
	};
	return [searchTool, readTool];
}

const shorten = (value: string, max: number) =>
	value.length > max ? `${value.slice(0, max - 1)}…` : value;

function pageName(url: unknown): string {
	if (typeof url !== "string") return "a page";
	try {
		const { hostname, pathname } = new URL(url);
		return shorten(`${hostname.replace(/^www\./, "")}${pathname === "/" ? "" : pathname}`, 60);
	} catch {
		return "a page";
	}
}

/** What Activity calls a web tool call, or nothing if it isn't one. */
export function webLabels(
	name: string,
	args: unknown,
): { label: string; runningLabel: string } | undefined {
	const input = args as { query?: unknown; url?: unknown; offset?: unknown } | undefined;
	if (name === WEB_SEARCH) {
		const query = typeof input?.query === "string" ? `“${shorten(input.query, 60)}”` : "the web";
		return { label: `Searched ${query}`, runningLabel: `Searching ${query}` };
	}
	if (name === READ_PAGE) {
		const more = typeof input?.offset === "number" && input.offset > 0 ? "more of " : "";
		const page = `${more}${pageName(input?.url)}`;
		return { label: `Read ${page}`, runningLabel: `Reading ${page}` };
	}
	return undefined;
}

/** The result the guard leaves in place of a search it stopped. */
export const isSearchLimit = (result: {
	isError: boolean;
	content: readonly { type: string; text?: string }[];
}) =>
	result.isError &&
	result.content.some((part) => part.type === "text" && part.text?.startsWith(SEARCH_LIMIT_MARK));

/** What to say about a run that ended on the guard, or nothing if it didn't. */
export const searchLimitNotice = (tail: Message | undefined) =>
	tail?.role === "toolResult" && isSearchLimit(tail) ? SEARCH_LIMIT_NOTICE : undefined;

/**
 * Stops a run that keeps searching. Once a run passes the limit, every later tool call is
 * refused too, so the run ends after that step instead of paying for more model calls.
 */
export function searchGuard() {
	let searches = 0;
	let tripped = false;
	return {
		reset() {
			searches = 0;
			tripped = false;
		},
		check(toolName: string): BeforeToolCallResult | undefined {
			if (toolName === WEB_SEARCH && ++searches > SEARCH_LIMIT) tripped = true;
			return tripped ? { block: true, reason: SEARCH_LIMIT_REASON, terminate: true } : undefined;
		},
		/** Another hook's check first, then this one. */
		after(before: AgentOptions["beforeToolCall"]): AgentOptions["beforeToolCall"] {
			return async (context, signal) =>
				(await before?.(context, signal)) ?? this.check(context.toolCall.name);
		},
	};
}
