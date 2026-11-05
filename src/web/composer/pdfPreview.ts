/// <reference types="vite/client" />
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

/** Twice the card's width, so the page stays sharp on high-density screens. */
const PREVIEW_WIDTH = 320;

/** Draw a PDF's first page to an image URL. pdf.js loads only once a PDF is attached. */
export async function renderPdfPreview(file: File): Promise<string | undefined> {
	const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
	GlobalWorkerOptions.workerSrc = workerUrl;
	const task = getDocument({ data: await file.arrayBuffer() });
	try {
		const page = await (await task.promise).getPage(1);
		const scale = PREVIEW_WIDTH / page.getViewport({ scale: 1 }).width;
		const viewport = page.getViewport({ scale });
		const canvas = document.createElement("canvas");
		canvas.width = Math.ceil(viewport.width);
		canvas.height = Math.ceil(viewport.height);
		await page.render({ canvas, viewport }).promise;
		const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/png"));
		return blob ? URL.createObjectURL(blob) : undefined;
	} finally {
		await task.destroy();
	}
}
