import { useCallback, useEffect, useState } from "react";
import type { Citation } from "../../shared/citations.ts";
import type { AttachmentInfo } from "../../shared/protocol.ts";

/** Just longer than the pane's closing animation. */
const CLOSE_MS = 150;

export interface PaneTarget {
	sessionId: string;
	attachment: AttachmentInfo;
	/** The passage to show. Each click makes a new object, so clicking the same link again still jumps. */
	citation?: Citation;
}

export function useAttachmentPane() {
	const [target, setTarget] = useState<PaneTarget>();
	const [open, setOpen] = useState(false);
	const [page, setPage] = useState<number>();

	// The file stays on screen while the pane closes, then leaves memory.
	useEffect(() => {
		if (open) return;
		const timer = setTimeout(() => setTarget(undefined), CLOSE_MS);
		return () => clearTimeout(timer);
	}, [open]);

	// Another file's page number means nothing here, and the same file stays where it is.
	const show = useCallback((next: PaneTarget) => {
		setTarget((current) => {
			if (current?.attachment.id !== next.attachment.id) setPage(undefined);
			return next;
		});
		setOpen(true);
	}, []);
	const close = useCallback(() => {
		setOpen(false);
		setPage(undefined);
	}, []);

	return { target, open, page, setPage, show, close };
}
