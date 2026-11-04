import { useEffect, useState } from "react";
import type { AttachmentInfo } from "../../shared/protocol.ts";
import { fetchImageUrl } from "../api.ts";

export function SavedImage({
	sessionId,
	attachment,
}: {
	sessionId: string;
	attachment: AttachmentInfo;
}) {
	const [url, setUrl] = useState<string>();
	const [failed, setFailed] = useState(false);
	useEffect(() => {
		let active = true;
		let created: string | undefined;
		fetchImageUrl(sessionId, attachment.id)
			.then((next) => {
				created = next;
				if (active) setUrl(next);
				else URL.revokeObjectURL(next);
			})
			.catch(() => active && setFailed(true));
		return () => {
			active = false;
			if (created) URL.revokeObjectURL(created);
		};
	}, [sessionId, attachment.id]);
	if (failed) return <span className="sent-file">{attachment.name}</span>;
	return url ? (
		<img src={url} alt={attachment.name} />
	) : (
		<span className="image-placeholder" aria-label={attachment.name} />
	);
}
