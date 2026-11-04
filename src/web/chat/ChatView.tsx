import { useEffect, useRef } from "react";
import type { EngineStatus, TranscriptMessage } from "../../shared/protocol.ts";
import "./chat.css";
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
		<div className="scroller" ref={scroller}>
			<main className="column" aria-live="polite">
				{error && <p className="notice notice-error">{error}</p>}
				{status && !status.ready && (
					<div className="setup">
						<h2>Add your API key to start</h2>
						<p>
							{status.reason} Add it to <code>.env.local</code> in the project folder, then restart
							the app.
						</p>
					</div>
				)}
				{messages.length === 0 && status?.ready && (
					<div className="empty">
						<h1>What do you want to understand?</h1>
						<p>Ask a question, or add images, PDFs, and text files.</p>
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
				{running && messages.at(-1)?.blocks.length === 0 && <p className="thinking">Thinking…</p>}
			</main>
		</div>
	);
}
