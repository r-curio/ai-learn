import { useCallback, useState } from "react";
import type { AttachmentInfo } from "../../shared/protocol.ts";
import { uploadAttachment } from "../api.ts";
import { isCsv, readCsvPreview } from "./csvPreview.ts";
import { renderPdfPreview } from "./pdfPreview.ts";

export interface Draft {
	key: string;
	file: File;
	preview?: string;
	/** The first rows of a CSV, shown as a small table. */
	table?: string[][];
	state: "uploading" | "ready" | "failed";
	info?: AttachmentInfo;
	error?: string;
}

let nextKey = 0;

/** Files attached to the unsent message. Each uploads right away, so errors show early. */
export function useDrafts() {
	const [drafts, setDrafts] = useState<Draft[]>([]);

	const addFiles = useCallback((sessionId: string, files: File[]) => {
		for (const file of files) {
			const key = `draft-${++nextKey}`;
			const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
			const change = (next: Partial<Draft>) =>
				setDrafts((current) => current.map((d) => (d.key === key ? { ...d, ...next } : d)));
			setDrafts((current) => [...current, { key, file, preview, state: "uploading" }]);
			if (file.type === "application/pdf") {
				// A preview is optional. Without one, the card shows a file icon.
				renderPdfPreview(file)
					.then((pdfPreview) => change({ preview: pdfPreview }))
					.catch(() => undefined);
			}
			if (isCsv(file)) {
				// A preview is optional. Without one, the card shows a file icon.
				readCsvPreview(file)
					.then((table) => change({ table }))
					.catch(() => undefined);
			}
			uploadAttachment(sessionId, file)
				.then((info) => change({ state: "ready", info }))
				.catch((cause: Error) => change({ state: "failed", error: cause.message }));
		}
	}, []);

	const removeDraft = (key: string) =>
		setDrafts((current) => current.filter((draft) => draft.key !== key));
	const clearDrafts = useCallback(() => setDrafts([]), []);
	const attachments = drafts.flatMap((draft) => (draft.state === "ready" ? [draft.info!] : []));
	const uploading = drafts.some((draft) => draft.state === "uploading");

	return { drafts, attachments, uploading, addFiles, removeDraft, clearDrafts };
}
