import { useEffect, useRef } from "react";
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

export function ChatView(props: ChatViewProps) {
	const { status, error, sessionId, messages, running, canRetry, onRetry } = props;
	const scroller = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const element = scroller.current;
		if (element) element.scrollTop = element.scrollHeight;
	}, [messages]);

	return (
		<div className="flex-1 overflow-y-auto" ref={scroller}>
			<main className="chat-column flex min-h-full flex-col gap-[22px] py-7" aria-live="polite">
				{error && <Notice error>{error}</Notice>}
				{status && !status.ready && (
					<div className="rounded-[10px] border border-line bg-surface px-5 py-[18px]">
						<h2 className="mb-1.5 text-[17px] font-bold">Add your API key to start</h2>
						<p className="text-muted">
							{status.reason} Add it to <code className="[all:revert]">.env.local</code> in the
							project folder, then restart the app.
						</p>
					</div>
				)}
				{messages.length === 0 && status?.ready && (
					<div className="my-auto pb-[8vh]">
						<h1 className="mb-1.5 text-[28px] font-semibold tracking-[-0.015em]">
							What do you want to understand?
						</h1>
						<p className="text-muted">Ask a question, or add images, PDFs, and text files.</p>
					</div>
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
					<p className="text-[14px] text-muted">Thinking…</p>
				)}
			</main>
		</div>
	);
}
