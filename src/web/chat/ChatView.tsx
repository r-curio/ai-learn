import { useEffect, useRef } from "react";
import type { EngineStatus, TranscriptMessage } from "../../shared/protocol.ts";
import { Card, CardDescription, CardHeader, CardTitle } from "../components/card.tsx";
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
					<Card className="block rounded-[10px] border border-border px-5 py-[18px] text-[16px] ring-0">
						<CardHeader className="block px-0">
							<CardTitle role="heading" aria-level={2} className="mb-1.5 text-[17px] font-bold">
								Add your API key to start
							</CardTitle>
							<CardDescription className="text-[16px]">
								{status.reason} Add it to <code className="[all:revert]">.env.local</code> in the
								project folder, then restart the app.
							</CardDescription>
						</CardHeader>
					</Card>
				)}
				{messages.length === 0 && status?.ready && (
					<div className="my-auto pb-[8vh]">
						<h1 className="mb-1.5 text-[28px] font-semibold tracking-[-0.015em]">
							What do you want to understand?
						</h1>
						<p className="text-muted-foreground">
							Ask a question, or add images, PDFs, and text files.
						</p>
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
					<p className="text-[14px] text-muted-foreground">Thinking…</p>
				)}
			</main>
		</div>
	);
}
