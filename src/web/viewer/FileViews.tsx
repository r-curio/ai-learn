import { useEffect, useState } from "react";
import { fetchAttachment } from "../api.ts";
import { Notice } from "../components/Notice.tsx";
import { Skeleton } from "../components/skeleton.tsx";
import { useAttachmentUrl } from "./useAttachmentUrl.ts";

/** A very large text file would freeze the window if it all went on screen. */
const MAX_TEXT_CHARS = 200_000;

export const OPEN_FAILED = "This file couldn't be opened.";

interface FileViewProps {
	sessionId: string;
	attachmentId: string;
	name: string;
}

export function ImageView({ sessionId, attachmentId, name }: FileViewProps) {
	const { url, failed } = useAttachmentUrl(sessionId, attachmentId);
	return (
		<div className="flex-1 overflow-auto p-5">
			{failed && <Notice error>{OPEN_FAILED}</Notice>}
			{!failed && !url && <Skeleton className="aspect-square w-full bg-border" />}
			{url && (
				<img className="mx-auto block max-w-full border border-border" src={url} alt={name} />
			)}
		</div>
	);
}

export function TextView({ sessionId, attachmentId }: FileViewProps) {
	const [text, setText] = useState<string>();
	const [failed, setFailed] = useState(false);
	useEffect(() => {
		let active = true;
		fetchAttachment(sessionId, attachmentId)
			.then((blob) => blob.text())
			.then((next) => active && setText(next))
			.catch(() => active && setFailed(true));
		return () => {
			active = false;
		};
	}, [sessionId, attachmentId]);
	return (
		<div className="flex-1 overflow-auto p-5">
			{failed && <Notice error>{OPEN_FAILED}</Notice>}
			{!failed && text === undefined && <Skeleton className="h-40 w-full bg-border" />}
			{text !== undefined && (
				<>
					<p className="wrap-anywhere whitespace-pre-wrap">{text.slice(0, MAX_TEXT_CHARS)}</p>
					{text.length > MAX_TEXT_CHARS && (
						<div className="mt-3">
							<Notice>This file is long, so only the start is shown.</Notice>
						</div>
					)}
				</>
			)}
		</div>
	);
}
