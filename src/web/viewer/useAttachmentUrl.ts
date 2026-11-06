import { useEffect, useState } from "react";
import { fetchAttachment } from "../api.ts";

/** A temporary URL for an attachment, released when it's no longer shown. */
export function useAttachmentUrl(sessionId: string, attachmentId: string) {
	const [url, setUrl] = useState<string>();
	const [failed, setFailed] = useState(false);
	useEffect(() => {
		let active = true;
		let created: string | undefined;
		fetchAttachment(sessionId, attachmentId)
			.then((blob) => {
				if (!active) return;
				created = URL.createObjectURL(blob);
				setUrl(created);
			})
			.catch(() => active && setFailed(true));
		return () => {
			active = false;
			if (created) URL.revokeObjectURL(created);
		};
	}, [sessionId, attachmentId]);
	return { url, failed };
}
