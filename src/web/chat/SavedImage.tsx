import { useEffect, useState } from "react";
import type { AttachmentInfo } from "../../shared/protocol.ts";
import { fetchImageUrl } from "../api.ts";
import { Skeleton } from "../components/skeleton.tsx";
import { SentFile } from "./SentFile.tsx";

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
	if (failed) return <SentFile name={attachment.name} />;
	return url ? (
		<img
			className="block size-20 rounded-xl border border-border object-cover"
			src={url}
			alt={attachment.name}
		/>
	) : (
		<Skeleton role="img" className="size-20 rounded-xl bg-border" aria-label={attachment.name} />
	);
}
