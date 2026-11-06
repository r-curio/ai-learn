import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AttachmentInfo, TranscriptMessage } from "../../shared/protocol.ts";
import { Button } from "../components/button.tsx";
import { Notice } from "../components/Notice.tsx";
import { ActivityBlock, hasActivity } from "./ActivityBlock.tsx";
import styles from "./prose.module.css";
import { SavedImage } from "./SavedImage.tsx";
import { isDocument, SentDocument, SentFile } from "./SentFile.tsx";

function TextBlock({ text, role }: { text: string; role: TranscriptMessage["role"] }) {
	if (role === "assistant") {
		return (
			<div className={styles.prose}>
				<Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>
			</div>
		);
	}
	return <p className="wrap-anywhere whitespace-pre-wrap">{text}</p>;
}

function SentAttachments({
	attachments,
	sessionId,
}: {
	attachments: AttachmentInfo[];
	sessionId: string;
}) {
	const images = attachments.filter(({ kind }) => kind === "image");
	const documents = attachments.filter((item) => item.kind !== "image" && isDocument(item));
	const files = attachments.filter((item) => item.kind !== "image" && !isDocument(item));
	return (
		<div className="flex max-w-full flex-col items-end gap-2">
			{images.length > 0 && (
				<ul className="flex flex-wrap justify-end gap-2">
					{images.map((attachment) => (
						<li key={attachment.id}>
							<SavedImage sessionId={sessionId} attachment={attachment} />
						</li>
					))}
				</ul>
			)}
			{documents.length > 0 && (
				<ul className="flex flex-col items-end gap-2">
					{documents.map((attachment) => (
						<li key={attachment.id}>
							<SentDocument attachment={attachment} />
						</li>
					))}
				</ul>
			)}
			{files.length > 0 && (
				<ul className="flex flex-wrap justify-end gap-2">
					{files.map((attachment) => (
						<li key={attachment.id}>
							<SentFile name={attachment.name} />
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

export function MessageView({
	message,
	sessionId,
	onRetry,
	liveSince,
}: {
	message: TranscriptMessage;
	sessionId: string;
	onRetry?: () => void;
	/** When this reply's run started, while it's still running. */
	liveSince?: number;
}) {
	const learner = message.role === "user";
	const showActivity = !learner && hasActivity(message, liveSince);
	const texts = message.blocks.flatMap((block) => (block.kind === "text" ? [block.text] : []));
	const hasBody = texts.length > 0 || Boolean(message.notice);
	return (
		<article
			className={
				learner
					? "flex max-w-[min(440px,92%)] flex-col items-end gap-2 self-end"
					: "flex flex-col gap-5"
			}
		>
			{showActivity && <ActivityBlock message={message} liveSince={liveSince} />}
			{message.attachments && message.attachments.length > 0 && (
				<SentAttachments attachments={message.attachments} sessionId={sessionId} />
			)}
			{hasBody && (
				<div
					className={
						learner ? "rounded-2xl bg-accent px-4 py-2.5 leading-[23px]" : "flex flex-col gap-3"
					}
				>
					{texts.map((text, index) => (
						<TextBlock text={text} role={message.role} key={index} />
					))}
					{message.notice && (
						<Notice
							error={message.failed}
							action={
								onRetry && (
									<Button
										variant="outline"
										className="h-7 px-2.5 py-0 text-[13px] leading-[18px] font-medium text-foreground"
										onClick={onRetry}
									>
										Retry
									</Button>
								)
							}
						>
							{message.notice}
						</Notice>
					)}
				</div>
			)}
		</article>
	);
}
