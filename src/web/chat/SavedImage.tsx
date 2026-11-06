import type { AttachmentInfo } from "../../shared/protocol.ts";
import { Button } from "../components/button.tsx";
import { Skeleton } from "../components/skeleton.tsx";
import { useAttachmentUrl } from "../viewer/useAttachmentUrl.ts";
import { SentFile } from "./SentFile.tsx";

export function SavedImage({
	sessionId,
	attachment,
	onOpen,
}: {
	sessionId: string;
	attachment: AttachmentInfo;
	onOpen: () => void;
}) {
	const { url, failed } = useAttachmentUrl(sessionId, attachment.id);
	if (failed) return <SentFile name={attachment.name} onOpen={onOpen} />;
	return url ? (
		<Button variant="ghost" size="icon" className="size-20 rounded-xl p-0" onClick={onOpen}>
			<img
				className="block size-20 rounded-xl border border-border object-cover"
				src={url}
				alt={attachment.name}
			/>
		</Button>
	) : (
		<Skeleton role="img" className="size-20 rounded-xl bg-border" aria-label={attachment.name} />
	);
}
