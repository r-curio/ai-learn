import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { TranscriptMessage } from "../../shared/protocol.ts";
import { SavedImage } from "./SavedImage.tsx";

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
		<article className={`message message-${message.role}`}>
			{message.attachments && message.attachments.length > 0 && (
				<ul className="sent-attachments">
					{message.attachments.map((attachment) => (
						<li key={attachment.id}>
							{attachment.kind === "image" ? (
								<SavedImage sessionId={sessionId} attachment={attachment} />
							) : (
								<span className="sent-file">{attachment.name}</span>
							)}
						</li>
					))}
				</ul>
			)}
			{message.blocks.map((block, index) =>
				block.kind === "text" ? (
					message.role === "assistant" ? (
						<div className="prose" key={index}>
							<Markdown remarkPlugins={[remarkGfm]}>{block.text}</Markdown>
						</div>
					) : (
						<p className="user-text" key={index}>
							{block.text}
						</p>
					)
				) : (
					<p className={`tool tool-${block.state}`} key={block.id}>
						{block.label}
						{block.state === "running" ? "…" : block.state === "failed" ? " failed" : ""}
					</p>
				),
			)}
			{message.notice && (
				<p className={message.failed ? "notice notice-error" : "notice"}>
					{message.notice}
					{onRetry && (
						<button type="button" className="button-inline" onClick={onRetry}>
							Retry
						</button>
					)}
				</p>
			)}
		</article>
	);
}
