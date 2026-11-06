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

function part(text: string, match: boolean): SnippetPart[] {
	const clean = text.replace(/\s+/g, " ");
	return clean ? [{ text: clean, match }] : [];
}

/** Split a marked snippet into parts, so the UI never has to treat chat text as HTML. */
export function snippetParts(snippet: string): SnippetPart[] {
	const [before = "", ...pieces] = snippet.split(MATCH_START);
	return [
		...part(before, false),
		...pieces.flatMap((piece) => {
			const [match = "", rest = ""] = piece.split(MATCH_END);
			return [...part(match, true), ...part(rest, false)];
		}),
	];
}
