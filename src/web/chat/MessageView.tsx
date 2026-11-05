import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AttachmentInfo, TranscriptBlock, TranscriptMessage } from "../../shared/protocol.ts";
import { Button } from "../components/button.tsx";
import { Notice } from "../components/Notice.tsx";
import styles from "./prose.module.css";
import { SavedImage } from "./SavedImage.tsx";
import { isDocument, SentDocument, SentFile } from "./SentFile.tsx";

const toolTone = {
	running: "text-muted-foreground",
	done: "text-muted-foreground",
	failed: "text-destructive",
};

function BlockView({ block, role }: { block: TranscriptBlock; role: TranscriptMessage["role"] }) {
	if (block.kind === "tool") {
		return (
			<p className={`my-1.5 text-[13px] ${toolTone[block.state]}`}>
				{block.label}
				{block.state === "running" ? "…" : block.state === "failed" ? " failed" : ""}
			</p>
		);
	}
	if (role === "assistant") {
		return (
			<div className={styles.prose}>
				<Markdown remarkPlugins={[remarkGfm]}>{block.text}</Markdown>
			</div>
		);
	}
	return <p className="wrap-anywhere whitespace-pre-wrap">{block.text}</p>;
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
}: {
	message: TranscriptMessage;
	sessionId: string;
	onRetry?: () => void;
}) {
	const learner = message.role === "user";
	const hasBody = message.blocks.length > 0 || Boolean(message.notice);
	return (
		<article
			className={
				learner
					? "flex max-w-[82%] flex-col items-end gap-2 self-end max-md:max-w-[92%]"
					: undefined
			}
		>
			{message.attachments && message.attachments.length > 0 && (
				<SentAttachments attachments={message.attachments} sessionId={sessionId} />
			)}
			{hasBody && (
				<div className={learner ? "rounded-[14px] bg-muted px-3.5 py-2.5" : undefined}>
					{message.blocks.map((block, index) => (
						<BlockView
							block={block}
							role={message.role}
							key={block.kind === "tool" ? block.id : index}
						/>
					))}
					{message.notice && (
						<Notice error={message.failed}>
							{message.notice}
							{onRetry && (
								<Button variant="link" size="inline" onClick={onRetry}>
									Retry
								</Button>
							)}
						</Notice>
					)}
				</div>
			)}
		</article>
	);
}
