import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { memo, useEffect, useRef, useState, type RefObject } from "react";
import type { Citation } from "../../shared/citations.ts";
import { fetchAttachment } from "../api.ts";
import { Notice } from "../components/Notice.tsx";
import { Skeleton } from "../components/skeleton.tsx";
import { openPdf } from "../pdf.ts";
import { OPEN_FAILED } from "./FileViews.tsx";
import { useKeepInView, useQuoteRects } from "./pageHighlight.ts";

/** Pages this close to the current one stay drawn, so scrolling doesn't show blank sheets. */
const DRAWN_AROUND = 2;
/** Space beside a page, matching the scroller's padding. */
const GUTTER = 40;
/** Keeps pages readable in a very wide window. */
const MAX_PAGE_WIDTH = 900;
/** Redrawing is slow, so wait until the pane has stopped changing size. */
const RESIZE_SETTLE_MS = 150;

function usePdfDocument(sessionId: string, attachmentId: string) {
	const [pdf, setPdf] = useState<{ document: PDFDocumentProxy; firstPageRatio: number }>();
	const [failed, setFailed] = useState(false);
	useEffect(() => {
		let active = true;
		let task: Awaited<ReturnType<typeof openPdf>> | undefined;
		async function load() {
			const blob = await fetchAttachment(sessionId, attachmentId);
			const data = await blob.arrayBuffer();
			if (!active) return;
			task = await openPdf(data);
			if (!active) return void task.destroy();
			const document = await task.promise;
			const { width, height } = (await document.getPage(1)).getViewport({ scale: 1 });
			if (active) setPdf({ document, firstPageRatio: width / height });
		}
		load().catch(() => active && setFailed(true));
		return () => {
			active = false;
			void task?.destroy();
		};
	}, [sessionId, attachmentId]);
	return { pdf, failed };
}

interface PdfPageProps {
	document: PDFDocumentProxy;
	number: number;
	/** Pages of an unusual shape correct this once they load. */
	initialRatio: number;
	/** The width to draw at, in CSS pixels. */
	width: number;
	drawn: boolean;
	/** The words to highlight on this page. */
	quote?: string;
}

/** The marker over a cited passage. It multiplies with the page, so the text stays readable beneath it. */
function PageHighlight({
	document,
	number,
	quote,
}: {
	document: PDFDocumentProxy;
	number: number;
	quote: string;
}) {
	const rects = useQuoteRects(document, number, quote);
	return rects.map((rect, index) => (
		<div
			key={index}
			data-highlight
			className="pointer-events-none absolute bg-highlight mix-blend-multiply"
			style={{
				left: `${rect.left * 100}%`,
				top: `${rect.top * 100}%`,
				width: `${rect.width * 100}%`,
				height: `${rect.height * 100}%`,
			}}
		/>
	));
}

/** One sheet. It always holds its space, and has a canvas only while it's near the current page. */
const PdfPage = memo(function PdfPage(props: PdfPageProps) {
	const { document: pdf, number, initialRatio, width, drawn, quote } = props;
	const sheet = useRef<HTMLDivElement>(null);
	const [ratio, setRatio] = useState(initialRatio);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		const element = sheet.current;
		if (!element) return;
		if (!drawn || width === 0) {
			if (!drawn) element.replaceChildren();
			return;
		}
		let active = true;
		let task: RenderTask | undefined;
		async function draw(target: HTMLDivElement) {
			const page = await pdf.getPage(number);
			if (!active) return;
			const natural = page.getViewport({ scale: 1 });
			setRatio(natural.width / natural.height);
			const viewport = page.getViewport({
				scale: (width * window.devicePixelRatio) / natural.width,
			});
			const canvas = document.createElement("canvas");
			canvas.width = Math.ceil(viewport.width);
			canvas.height = Math.ceil(viewport.height);
			canvas.className = "block size-full";
			task = page.render({ canvas, viewport });
			await task.promise;
			// Swapping in the finished canvas keeps the old one up during a resize, with no white flash.
			if (active) target.replaceChildren(canvas);
		}
		draw(element).catch((cause: Error) => {
			if (active && cause.name !== "RenderingCancelledException") setFailed(true);
		});
		return () => {
			active = false;
			task?.cancel();
		};
	}, [pdf, number, width, drawn]);

	return (
		<div
			data-page={number}
			className="relative w-full max-w-[900px] flex-none border border-border bg-page"
		>
			<div ref={sheet} style={{ aspectRatio: ratio }} />
			{quote && <PageHighlight document={pdf} number={number} quote={quote} />}
			{failed && (
				<div className="absolute inset-0 grid place-items-center text-[13px] text-destructive">
					Page {number} couldn't be drawn.
				</div>
			)}
		</div>
	);
});

/** Watches the pane's width, ignoring changes until it settles. */
function useSettledWidth(element: RefObject<HTMLElement | null>) {
	const [width, setWidth] = useState(0);
	useEffect(() => {
		const target = element.current;
		if (!target) return;
		let timer: ReturnType<typeof setTimeout>;
		const observer = new ResizeObserver(() => {
			clearTimeout(timer);
			timer = setTimeout(() => setWidth(target.clientWidth), RESIZE_SETTLE_MS);
		});
		observer.observe(target);
		return () => {
			clearTimeout(timer);
			observer.disconnect();
		};
	}, [element]);
	return width;
}

/**
 * The current page is the one crossing the middle of the pane. Short pages like slides never reach
 * the middle at either end of the document, so the top and bottom always mean the first and last.
 */
function useCurrentPage(scroller: RefObject<HTMLElement | null>, total: number, paneWidth: number) {
	const [current, setCurrent] = useState(1);
	useEffect(() => {
		const root = scroller.current;
		if (!root || total === 0) return;
		function update(element: HTMLElement) {
			const { scrollTop, scrollHeight, clientHeight } = element;
			const line = scrollTop + clientHeight / 2;
			const pages = Array.from(element.querySelectorAll<HTMLElement>("[data-page]"));
			const inMiddle = pages.find((page) => page.offsetTop + page.offsetHeight >= line);
			const atBottom = scrollHeight - clientHeight - scrollTop < 1;
			const page = scrollTop <= 0 ? pages[0] : atBottom ? pages.at(-1) : inMiddle;
			if (page) setCurrent(Number(page.dataset.page));
		}
		const onScroll = () => update(root);
		update(root);
		root.addEventListener("scroll", onScroll, { passive: true });
		return () => root.removeEventListener("scroll", onScroll);
	}, [scroller, total, paneWidth]);
	return current;
}

export function PdfView({
	sessionId,
	attachmentId,
	citation,
	onPageChange,
}: {
	sessionId: string;
	attachmentId: string;
	citation?: Citation;
	onPageChange: (page: { current: number; total: number }) => void;
}) {
	const { pdf, failed } = usePdfDocument(sessionId, attachmentId);
	const scroller = useRef<HTMLDivElement>(null);
	const paneWidth = useSettledWidth(scroller);
	const total = pdf?.document.numPages ?? 0;
	const current = useCurrentPage(scroller, total, paneWidth);
	// The border sits outside the drawing, on both sides.
	const pageWidth = Math.max(0, Math.min(paneWidth - GUTTER, MAX_PAGE_WIDTH) - 2);

	useEffect(() => {
		if (total > 0) onPageChange({ current, total });
	}, [current, total, onPageChange]);

	useKeepInView(scroller, citation?.page, total, citation);

	if (failed) {
		return (
			<div className="p-5">
				<Notice error>{OPEN_FAILED}</Notice>
			</div>
		);
	}
	return (
		<div
			ref={scroller}
			className="relative flex min-h-0 flex-1 flex-col items-center gap-5 overflow-y-auto px-5 pt-5 pb-5"
		>
			{!pdf && <Skeleton className="aspect-[3/4] w-full flex-none bg-border" />}
			{pdf &&
				Array.from({ length: total }, (_, index) => (
					<PdfPage
						key={index}
						document={pdf.document}
						number={index + 1}
						initialRatio={pdf.firstPageRatio}
						width={pageWidth}
						drawn={Math.abs(index + 1 - current) <= DRAWN_AROUND}
						quote={citation?.page === index + 1 ? citation.quote : undefined}
					/>
				))}
		</div>
	);
}
