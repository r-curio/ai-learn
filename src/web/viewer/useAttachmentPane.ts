import { useCallback, useEffect, useState } from "react";
import type { AttachmentInfo } from "../../shared/protocol.ts";

/** Just longer than the pane's closing animation. */
const CLOSE_MS = 150;

export interface PaneTarget {
	sessionId: string;
	attachment: AttachmentInfo;
}

export function useAttachmentPane() {
	const [target, setTarget] = useState<PaneTarget>();
	const [open, setOpen] = useState(false);

	// The file stays on screen while the pane closes, then leaves memory.
	useEffect(() => {
		if (open) return;
		const timer = setTimeout(() => setTarget(undefined), CLOSE_MS);
		return () => clearTimeout(timer);
	}, [open]);

	const show = useCallback((next: PaneTarget) => {
		setTarget(next);
		setOpen(true);
	}, []);
	const close = useCallback(() => setOpen(false), []);

	return { target, open, show, close };
}
