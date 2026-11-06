import type { PDFDocumentProxy } from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import { useEffect, useState, type RefObject } from "react";
import { foldText } from "../../shared/citations.ts";

/** The space left above a page scrolled to the top, matching the scroller's padding. */
const PAGE_TOP_GAP = 20;

/** A box on a page, as fractions of the page's size. */
export interface PageRect {
	left: number;
	top: number;
	width: number;
	height: number;
}

interface PlacedItem {
	text: string;
	end: string;
	/** Where this item starts in the page's text, joined as the server joins it when it saves. */
	start: number;
	left: number;
	top: number;
	width: number;
	height: number;
}

/** Place each run of text on the page. pdf.js measures from the bottom left, and pages from the top. */
function placeItems(items: TextItem[], pageWidth: number, pageHeight: number): PlacedItem[] {
	let start = 0;
	return items.flatMap((item) => {
		if (!item.str) return [];
		const [, , , scaleY = 0, x = 0, y = 0] = item.transform as number[];
		const height = item.height || Math.abs(scaleY);
		const placed = {
			text: item.str,
			end: item.hasEOL ? "\n" : " ",
			start,
			left: x / pageWidth,
			top: (pageHeight - y - height * 0.8) / pageHeight,
			width: item.width / pageWidth,
			height: (height * 1.1) / pageHeight,
		};
		start += item.str.length + 1;
		return [placed];
	});
}

/** The boxes covering a quote. Character widths inside a run are estimated from its overall width. */
export function quoteRects(
	items: TextItem[],
	pageWidth: number,
	pageHeight: number,
	quote: string,
): PageRect[] {
	const placed = placeItems(items, pageWidth, pageHeight);
	const page = foldText(placed.map(({ text, end }) => text + end).join(""));
	const wanted = foldText(quote).folded;
	const found = wanted ? page.folded.indexOf(wanted) : -1;
	if (found < 0) return [];
	const first = page.origins[found] ?? 0;
	const last = page.origins[found + wanted.length - 1] ?? first;
	return placed.flatMap((item) => {
		const from = Math.max(first - item.start, 0);
		const to = Math.min(last - item.start + 1, item.text.length);
		if (from >= to) return [];
		const share = item.width / item.text.length;
		return [
			{
				left: item.left + from * share,
				top: item.top,
				width: (to - from) * share,
				height: item.height,
			},
		];
	});
}

/** Find a quote on one page. A quote that can't be found leaves the page open with no highlight. */
export function useQuoteRects(
	document: PDFDocumentProxy,
	number: number,
	quote: string,
): PageRect[] {
	const [rects, setRects] = useState<PageRect[]>([]);
	useEffect(() => {
		let active = true;
		async function find() {
			const page = await document.getPage(number);
			const { width, height } = page.getViewport({ scale: 1 });
			const { items } = await page.getTextContent();
			const textItems = items.filter((item): item is TextItem => "str" in item);
			if (active) setRects(quoteRects(textItems, width, height, quote));
		}
		find().catch(() => active && setRects([]));
		return () => {
			active = false;
		};
	}, [document, number, quote]);
	return rects;
}

/**
 * Hold a cited page in view, with its highlight centred once it's measured. The pane is still
 * growing and pages are still finding their shape when it opens, so one scroll wouldn't land. This
 * lets go as soon as the learner moves the page themselves. `request` changes with each click.
 */
export function useKeepInView(
	scroller: RefObject<HTMLElement | null>,
	page: number | undefined,
	total: number,
	request: unknown,
) {
	useEffect(() => {
		const root = scroller.current;
		const sheet = root?.querySelector<HTMLElement>(`[data-page="${page}"]`);
		if (!root || !sheet) return;
		function place(pane: HTMLElement, target: HTMLElement) {
			const mark = target.querySelector<HTMLElement>("[data-highlight]");
			pane.scrollTop = mark
				? target.offsetTop + mark.offsetTop - (pane.clientHeight - mark.offsetHeight) / 2
				: target.offsetTop - PAGE_TOP_GAP;
		}
		const update = () => place(root, sheet);
		const sizes = new ResizeObserver(update);
		sizes.observe(root);
		root.querySelectorAll("[data-page]").forEach((element) => sizes.observe(element));
		const marks = new MutationObserver(update);
		marks.observe(sheet, { childList: true });
		const release = () => {
			sizes.disconnect();
			marks.disconnect();
		};
		const moves = ["wheel", "touchmove", "pointerdown", "keydown"];
		moves.forEach((move) => root.addEventListener(move, release, { passive: true }));
		update();
		return () => {
			release();
			moves.forEach((move) => root.removeEventListener(move, release));
		};
	}, [scroller, page, total, request]);
}
