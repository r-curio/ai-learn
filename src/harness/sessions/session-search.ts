import type { SnippetPart } from "../../shared/protocol.ts";

/** Private-use characters that mark a match in FTS5 snippets. They're stripped from indexed text. */
export const MATCH_START = "";
export const MATCH_END = "";

export function stripMatchMarkers(text: string): string {
	return text.replace(/[]/g, "");
}

/**
 * Turn what the learner typed into an FTS5 query. Each word is quoted, so no character can act as
 * FTS5 syntax, and is a prefix, so results narrow as they type. Undefined means nothing to search.
 */
export function toFtsQuery(typed: string): string | undefined {
	const words = typed.replaceAll("\0", " ").trim().split(/\s+/).filter(Boolean);
	if (words.length === 0) return undefined;
	return words.map((word) => `"${word.replaceAll('"', '""')}"*`).join(" ");
}

/** Enough words before a match to read it in context, while keeping it on the sidebar's one line. */
const LEAD_CHARS = 16;

function clean(text: string): string {
	return text.replace(/\s+/g, " ");
}

function part(text: string, match: boolean): SnippetPart[] {
	return text ? [{ text, match }] : [];
}

function shortenLead(lead: string): string {
	if (lead.length <= LEAD_CHARS) return lead;
	const tail = lead.slice(-LEAD_CHARS);
	return `…${tail.slice(tail.indexOf(" ") + 1)}`;
}

/** Split a marked snippet into parts, so the UI never has to treat chat text as HTML. */
export function snippetParts(snippet: string): SnippetPart[] {
	const [before = "", ...pieces] = snippet.split(MATCH_START);
	return [
		...part(pieces.length > 0 ? shortenLead(clean(before)) : clean(before), false),
		...pieces.flatMap((piece) => {
			const [match = "", rest = ""] = piece.split(MATCH_END);
			return [...part(clean(match), true), ...part(clean(rest), false)];
		}),
	];
}
