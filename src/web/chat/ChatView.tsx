import { useEffect, useRef, type ReactNode } from "react";
import type { EngineStatus, TranscriptMessage } from "../../shared/protocol.ts";
import { Notice } from "../components/Notice.tsx";
import { MessageView } from "./MessageView.tsx";

interface ChatViewProps {
	status?: EngineStatus;
	error?: string;
	sessionId?: string;
	messages: TranscriptMessage[];
	running: boolean;
	canRetry: boolean;
	onRetry: () => void;
}

const Code = ({ children }: { children: string }) => (
	<code className="font-mono text-[14px]">{children}</code>
);

/** What's missing and how to fix it. Names like ANTHROPIC_API_KEY in the reason are set as code. */
function SetupText({ reason = "" }: { reason?: string }) {
	const parts = reason.split(/\b([A-Z0-9]+(?:_[A-Z0-9]+)+)\b/);
	return (
		<>
			{parts.map((part, index) => (index % 2 ? <Code key={index}>{part}</Code> : part))} Add it to{" "}
			<Code>.env.local</Code> in the project folder, then restart the app.
		</>
	);
}

/** A centred heading and one line. The bottom padding sets the optical centre the frames use. */
function EmptyScreen({ title, children }: { title: string; children: ReactNode }) {
	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-3.5 pb-[26px] text-center">
			<h1 className="text-[32px] leading-10 font-medium tracking-[-0.02em]">{title}</h1>
			<p className="max-w-[520px] text-muted-foreground">{children}</p>
		</div>
	);
}

export function ChatView(props: ChatViewProps) {
	const { status, error, sessionId, messages, running, canRetry, onRetry } = props;
	const scroller = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const element = scroller.current;
		if (element) element.scrollTop = element.scrollHeight;
	}, [messages]);

	return (
		<div className="flex-1 overflow-y-auto" ref={scroller}>
			<main className="chat-column flex min-h-full flex-col gap-5 pt-3 pb-5" aria-live="polite">
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
					<EmptyScreen title="What do you want to understand?">
						Ask a question, or add images, PDFs, and text files.
					</EmptyScreen>
				)}
				{sessionId &&
					messages.map((message, index) => (
						<MessageView
							message={message}
							sessionId={sessionId}
							key={message.id}
							onRetry={canRetry && !running && index === messages.length - 1 ? onRetry : undefined}
						/>
					))}
				{running && messages.at(-1)?.blocks.length === 0 && (
					<p className="text-[13px] leading-[18px] text-muted-foreground">Thinking…</p>
				)}
			</main>
		</div>
	);
}
