/// <reference types="vite/client" />
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

/** Start loading a PDF. pdf.js itself is only downloaded once a PDF is needed. */
export async function openPdf(data: ArrayBuffer) {
	const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
	GlobalWorkerOptions.workerSrc = workerUrl;
	return getDocument({ data });
}
