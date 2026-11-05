import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { TranscriptBlock, TranscriptMessage } from "../../shared/protocol.ts";
import { Button } from "../components/Button.tsx";
import { Notice } from "../components/Notice.tsx";
import styles from "./prose.module.css";
import { SavedImage } from "./SavedImage.tsx";
import { SentFile } from "./SentFile.tsx";

const toolTone = { running: "text-muted", done: "text-muted", failed: "text-danger" };

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

export function MessageView({
	message,
	sessionId,
	onRetry,
}: {
	message: TranscriptMessage;
	sessionId: string;
	onRetry?: () => void;
}) {
	return (
		<article
			className={
				message.role === "user"
					? "max-w-[82%] self-end rounded-[14px] bg-user-bg px-3.5 py-2.5 max-md:max-w-[92%]"
					: undefined
			}
		>
			{message.attachments && message.attachments.length > 0 && (
				<ul className="flex flex-wrap gap-2 not-last:mb-2">
					{message.attachments.map((attachment) => (
						<li key={attachment.id}>
							{attachment.kind === "image" ? (
								<SavedImage sessionId={sessionId} attachment={attachment} />
							) : (
								<SentFile name={attachment.name} />
							)}
						</li>
					))}
				</ul>
			)}
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
						<Button variant="inline" size="inline" onClick={onRetry}>
							Retry
						</Button>
					)}
				</Notice>
			)}
		</article>
	);
}
