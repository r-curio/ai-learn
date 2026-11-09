import { cn } from "cn";
import type { MouseEvent } from "react";
import Markdown from "react-markdown";
import { parseCitations, type Citation } from "../../shared/citations.ts";
import type { AttachmentInfo, TranscriptMessage } from "../../shared/protocol.ts";
import { AnsweredConfidence } from "../answer/AnsweredConfidence.tsx";
import { Button } from "../components/button.tsx";
import { Notice } from "../components/Notice.tsx";
import { ActivityBlock, hasActivity } from "./ActivityBlock.tsx";
import { markdownPlugins } from "./markdown.ts";
import styles from "./prose.module.css";
import { SavedImage } from "./SavedImage.tsx";
import { isDocument, SentDocument, SentFile } from "./SentFile.tsx";

const CITATION_HREF = /^#cite-(\d+)$/;

/** The tutor's words, where a citation is a link that opens the passage in the attachment pane. */
function ReplyText({
	raw,
	live,
	onOpenCitation,
}: {
	raw: string;
	live: boolean;
	onOpenCitation: (citation: Citation) => void;
}) {
	const { text, citations } = parseCitations(raw, live);
	return (
		<div className={styles.prose}>
			<Markdown
				{...markdownPlugins}
				components={{
					a({ href, children }) {
						const citation = citations[Number(href?.match(CITATION_HREF)?.[1] ?? -1)];
						if (!citation) return <a href={href}>{children}</a>;
						const open = (event: MouseEvent) => {
							event.preventDefault();
							onOpenCitation(citation);
						};
						return (
							<a href={href} onClick={open} title={`Open page ${citation.page}`}>
								{children}
							</a>
						);
					},
				}}
			>
				{text}
			</Markdown>
		</div>
	);
}

function MessageText({
	text,
	learner,
	live,
	onOpenCitation,
}: {
	text: string;
	learner: boolean;
	live: boolean;
	onOpenCitation: (citation: Citation) => void;
}) {
	if (learner) return <p className="wrap-anywhere whitespace-pre-wrap">{text}</p>;
	return <ReplyText raw={text} live={live} onOpenCitation={onOpenCitation} />;
}

function SentAttachments({
	attachments,
	sessionId,
	onOpen,
}: {
	attachments: AttachmentInfo[];
	sessionId: string;
	onOpen: (attachment: AttachmentInfo) => void;
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
							<SavedImage
								sessionId={sessionId}
								attachment={attachment}
								onOpen={() => onOpen(attachment)}
							/>
						</li>
					))}
				</ul>
			)}
			{documents.length > 0 && (
				<ul className="flex flex-col items-end gap-2">
					{documents.map((attachment) => (
						<li key={attachment.id}>
							<SentDocument attachment={attachment} onOpen={() => onOpen(attachment)} />
						</li>
					))}
				</ul>
			)}
			{files.length > 0 && (
				<ul className="flex flex-wrap justify-end gap-2">
					{files.map((attachment) => (
						<li key={attachment.id}>
							<SentFile name={attachment.name} onOpen={() => onOpen(attachment)} />
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

function ReplyNotice({ message, onRetry }: { message: TranscriptMessage; onRetry?: () => void }) {
	if (!message.notice) return null;
	return (
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
	);
}

/** The waiting question is left out, because the answer card shows it. */
function visibleTexts(message: TranscriptMessage, pendingQuestionId?: string) {
	return message.blocks.flatMap((block) => {
		if (block.kind === "question") return block.id === pendingQuestionId ? [] : [block.text];
		return block.kind === "text" ? [block.text] : [];
	});
}

const learnerBubble = (isAnswer: boolean) =>
	cn(
		"rounded-2xl bg-accent px-4 py-2.5 leading-[23px]",
		isAnswer && "flex items-center gap-4 font-medium",
	);

export function MessageView({
	message,
	sessionId,
	onRetry,
	liveSince,
	pendingQuestionId,
	onOpenAttachment,
	onOpenCitation,
}: {
	message: TranscriptMessage;
	sessionId: string;
	onRetry?: () => void;
	/** When this reply's run started, while it's still running. */
	liveSince?: number;
	pendingQuestionId?: string;
	onOpenAttachment: (attachment: AttachmentInfo) => void;
	onOpenCitation: (citation: Citation) => void;
}) {
	const learner = message.role === "user";
	const showActivity = !learner && hasActivity(message, liveSince);
	const texts = visibleTexts(message, pendingQuestionId);
	const { confidence } = message;
	const hasBody = texts.length > 0 || Boolean(message.notice);
	return (
		<article
			className={
				learner
					? "flex max-w-[min(440px,92%)] flex-col items-end gap-2 self-end in-data-compact:max-w-[400px]"
					: "flex flex-col gap-5"
			}
		>
			{showActivity && <ActivityBlock message={message} liveSince={liveSince} />}
			{message.attachments && message.attachments.length > 0 && (
				<SentAttachments
					attachments={message.attachments}
					sessionId={sessionId}
					onOpen={onOpenAttachment}
				/>
			)}
			{hasBody && (
				<div className={learner ? learnerBubble(confidence !== undefined) : "flex flex-col gap-3"}>
					{texts.map((text, index) => (
						<MessageText
							text={text}
							learner={learner}
							live={liveSince !== undefined}
							onOpenCitation={onOpenCitation}
							key={index}
						/>
					))}
					{learner && confidence !== undefined && <AnsweredConfidence confidence={confidence} />}
					<ReplyNotice message={message} onRetry={onRetry} />
				</div>
			)}
		</article>
	);
}
