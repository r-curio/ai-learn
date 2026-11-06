import { useEffect, useRef, type ReactNode } from "react";
import type { Citation } from "../../shared/citations.ts";
import type {
	AttachmentInfo,
	ChatType,
	EngineStatus,
	Question,
	TranscriptMessage,
} from "../../shared/protocol.ts";
import { Notice } from "../components/Notice.tsx";
import { SegmentedTabs } from "../components/tabs.tsx";
import { MessageView } from "./MessageView.tsx";
import { PendingQuestion } from "./PendingQuestion.tsx";

interface ChatViewProps {
	status?: EngineStatus;
	error?: string;
	sessionId?: string;
	messages: TranscriptMessage[];
	running: boolean;
	runStartedAt: number;
	canRetry: boolean;
	pendingQuestion?: Question;
	onDontKnow: () => void;
	chatType: ChatType;
	onChatTypeChange: (chatType: ChatType) => void;
	onRetry: () => void;
	onOpenAttachment: (attachment: AttachmentInfo) => void;
	onOpenCitation: (citation: Citation) => void;
}

const CHAT_TYPE_OPTIONS = [
	{ value: "learning", label: "Learning" },
	{ value: "practice", label: "Practice" },
] as const;

const Code = ({ children }: { children: string }) => (
	<code className="font-mono text-[14px]">{children}</code>
);

/** What's missing and how to fix it. Names like ANTHROPIC_API_KEY in the reason are set as code. */
function SetupText({ reason = "" }: { reason?: string }) {
	const parts = reason.split(/(\.env\.local|\b[A-Z0-9]+(?:_[A-Z0-9]+)+\b)/);
	return <>{parts.map((part, index) => (index % 2 ? <Code key={index}>{part}</Code> : part))}</>;
}

/** A centred heading and one line. The bottom padding sets the optical centre the frames use. */
function EmptyScreen({
	title,
	children,
	below,
}: {
	title: string;
	children: ReactNode;
	below?: ReactNode;
}) {
	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-3.5 pb-[26px] text-center">
			<h1 className="text-[32px] leading-10 font-medium tracking-[-0.02em]">{title}</h1>
			<p className="max-w-[520px] text-muted-foreground">{children}</p>
			{below}
		</div>
	);
}

export function ChatView(props: ChatViewProps) {
	const { status, error, sessionId, messages, running, runStartedAt, canRetry, onRetry } = props;
	const { chatType, onChatTypeChange, onOpenAttachment, onOpenCitation } = props;
	const { pendingQuestion, onDontKnow } = props;
	const scroller = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const element = scroller.current;
		if (element) element.scrollTop = element.scrollHeight;
	}, [messages]);

	return (
		<div className="flex-1 overflow-y-auto" ref={scroller}>
			<main
				className="chat-column flex min-h-full flex-col gap-5 pt-3 pb-5 in-data-compact:gap-[18px] in-data-compact:pt-2"
				aria-live="polite"
			>
				{error && <Notice error>{error}</Notice>}
				{status && !status.ready && messages.length === 0 && (
					<EmptyScreen title="Add your API key to start">
						<SetupText reason={status.reason} />
					</EmptyScreen>
				)}
				{status && !status.ready && messages.length > 0 && (
					<Notice>
						<SetupText reason={status.reason} />
					</Notice>
				)}
				{status?.ready && messages.length === 0 && (
					<EmptyScreen
						title="What do you want to understand?"
						below={
							<SegmentedTabs
								label="Chat type"
								size="large"
								className="w-52"
								value={chatType}
								options={CHAT_TYPE_OPTIONS}
								onChange={onChatTypeChange}
							/>
						}
					>
						Ask a question, or attach a PDF, image or text file to work through.
					</EmptyScreen>
				)}
				{sessionId &&
					messages.map((message, index) => (
						<MessageView
							message={message}
							sessionId={sessionId}
							key={message.id}
							liveSince={running && index === messages.length - 1 ? runStartedAt : undefined}
							onRetry={canRetry && !running && index === messages.length - 1 ? onRetry : undefined}
							onOpenAttachment={onOpenAttachment}
							onOpenCitation={onOpenCitation}
						/>
					))}
				{pendingQuestion && !running && (
					<PendingQuestion question={pendingQuestion} onDontKnow={onDontKnow} />
				)}
			</main>
		</div>
	);
}
