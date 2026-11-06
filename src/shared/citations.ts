/** A passage of a PDF the tutor points to. It's written in the reply as a `<cite>` tag. */
export interface Citation {
	attachmentId: string;
	page: number;
	quote: string;
}

const CITE = /<cite attachment="([^"]+)" page="(\d+)">([\s\S]*?)<\/cite>/g;
const OPENING = '<cite attachment="';
/** A tag the reply stopped partway through, because it's still streaming or it was cut off. */
const UNCLOSED = /<cite attachment="(?:(?!<\/cite>)[\s\S])*$/;

/** While a reply streams, its end may be the first few characters of a tag. */
function withoutStartOfTag(text: string): string {
	for (let length = Math.min(OPENING.length - 1, text.length); length > 0; length--) {
		if (text.endsWith(OPENING.slice(0, length))) return text.slice(0, -length);
	}
	return text;
}

/** Replace each citation tag, and drop a tag that never closed. */
function replaceCitations(
	raw: string,
	replace: (citation: Citation) => string,
	live = false,
): string {
	const text = raw
		.replace(CITE, (_tag, attachmentId: string, page: string, quote: string) =>
			replace({ attachmentId, page: Number(page), quote }),
		)
		.replace(UNCLOSED, "");
	return live ? withoutStartOfTag(text) : text;
}

/** The reply as Markdown, with each citation as a `[p. 4](#cite-0)` link. */
export function parseCitations(raw: string, live = false) {
	const citations: Citation[] = [];
	const text = replaceCitations(
		raw,
		(citation) => {
			citations.push(citation);
			return `[p. ${citation.page}](#cite-${citations.length - 1})`;
		},
		live,
	);
	return { text, citations };
}

/** The reply as the learner reads it, for search. */
export const stripCitations = (raw: string) =>
	replaceCitations(raw, () => "").replace(/ +(\n|$)/g, "$1");

/** Remove citations that fail the check, leaving the reply as the model wrote it otherwise. */
export function keepCitations(raw: string, keep: (citation: Citation) => boolean): string {
	return raw.replace(CITE, (tag, attachmentId: string, page: string, quote: string) =>
		keep({ attachmentId, page: Number(page), quote }) ? tag : "",
	);
}

/** Line breaks, hyphenation, and typographic quotes differ between a PDF and a model's copy of it. */
function foldChar(char: string): string {
	if (/\s/.test(char) || char === "­") return "";
	if (/[‘’]/.test(char)) return "'";
	if (/[“”]/.test(char)) return '"';
	if (/[‐-―]/.test(char)) return "-";
	return char.toLowerCase();
}

/** Text in a form two copies of a passage can be compared in, with where each character came from. */
export function foldText(text: string): { folded: string; origins: number[] } {
	let folded = "";
	const origins: number[] = [];
	for (let index = 0; index < text.length; index++) {
		const char = foldChar(text.charAt(index));
		// A hyphen before a line break only splits a word across lines.
		if (char === "-" && /^\s*\n/.test(text.slice(index + 1, index + 40))) continue;
		for (const part of char) {
			folded += part;
			origins.push(index);
		}
	}
	return { folded, origins };
}

/** Whether a quote is really in this text. */
export function textContainsQuote(text: string, quote: string): boolean {
	const wanted = foldText(quote).folded;
	return wanted.length > 0 && foldText(text).folded.includes(wanted);
}
