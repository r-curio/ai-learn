import "katex/dist/katex.min.css";
import type { Options } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

/** Just the parts of a Markdown tree the callout plugin reads. */
interface MdNode {
	type: string;
	value?: string;
	children?: MdNode[];
	data?: { hProperties?: Record<string, string> };
}

const IMPORTANT = /^\[!IMPORTANT\][ \t]*(?:\r?\n|$)/;

/** A blockquote starting with `[!IMPORTANT]` becomes one callout, without the marker. */
function markCallout(quote: MdNode) {
	const paragraph = quote.children?.[0];
	const first = paragraph?.type === "paragraph" ? paragraph.children?.[0] : undefined;
	if (first?.type !== "text" || !first.value || !IMPORTANT.test(first.value)) return;
	first.value = first.value.replace(IMPORTANT, "");
	if (!first.value) paragraph?.children?.shift();
	// A soft break can follow the marker, which would leave a blank first line.
	if (paragraph?.children?.[0]?.type === "break") paragraph.children.shift();
	if (paragraph?.children?.length === 0) quote.children?.shift();
	quote.data = { ...quote.data, hProperties: { dataCallout: "important" } };
}

function remarkCallout() {
	const visit = (node: MdNode) => {
		if (node.type === "blockquote") markCallout(node);
		node.children?.forEach(visit);
	};
	return (tree: MdNode) => visit(tree);
}

/**
 * Maths that can't render yet, like a formula still streaming in, shows as its source in the
 * text colour rather than KaTeX's red, so it doesn't flash an error before it closes.
 */
const katexOptions = { throwOnError: false, errorColor: "inherit" };

/** How the tutor's Markdown renders: GFM, `$` and `$$` maths, and `[!IMPORTANT]` callouts. */
export const markdownPlugins = {
	remarkPlugins: [remarkGfm, remarkMath, remarkCallout],
	rehypePlugins: [[rehypeKatex, katexOptions]],
} satisfies Pick<Options, "remarkPlugins" | "rehypePlugins">;
