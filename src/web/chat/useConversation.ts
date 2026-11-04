import { useCallback, useState } from "react";
import {
	noticeFor,
	type AttachmentInfo,
	type RunEvent,
	type SessionView,
	type TranscriptMessage,
	type UsageSummary,
} from "../../shared/protocol.ts";
import { abortRun, getSession, retryRun, sendMessage } from "../api.ts";
import { applyRunEvent } from "./runEvents.ts";

let nextKey = 0;
const makeKey = () => `local-${++nextKey}`;

type StartRun = (onEvent: (event: RunEvent) => void) => Promise<void>;

/** The open chat: its messages, and sending to it. `onRunEnd` fires after each reply finishes. */
export function useConversation(onRunEnd: () => void) {
	const [sessionId, setSessionId] = useState<string>();
	const [messages, setMessages] = useState<TranscriptMessage[]>([]);
	const [canRetry, setCanRetry] = useState(false);
	const [usage, setUsage] = useState<UsageSummary>();
	const [running, setRunning] = useState(false);

	const showView = useCallback((view: SessionView) => {
		setSessionId(view.id);
		setMessages(view.messages);
		setCanRetry(view.canRetry);
		setUsage(view.usage);
	}, []);

	const showEmpty = useCallback((id: string) => {
		setSessionId(id);
		setMessages([]);
		setCanRetry(false);
		setUsage(undefined);
	}, []);

	const update = (id: string, change: (message: TranscriptMessage) => TranscriptMessage) =>
		setMessages((current) => current.map((item) => (item.id === id ? change(item) : item)));

	async function follow(replyId: string, startRun: StartRun) {
		const id = sessionId!;
		setRunning(true);
		setCanRetry(false);
		try {
			await startRun((event) => {
				if (event.type === "done") {
					setUsage(event.sessionUsage);
					const ending = noticeFor(event.stopReason, event.errorMessage);
					if (ending) update(replyId, (message) => ({ ...message, ...ending }));
				} else {
					update(replyId, (message) => applyRunEvent(message, event));
				}
			});
			showView(await getSession(id));
		} catch (cause) {
			const notice = (cause as Error).message;
			update(replyId, (message) => ({ ...message, notice, failed: true }));
		} finally {
			setRunning(false);
			onRunEnd();
		}
	}

	function send(text: string, attachments: AttachmentInfo[]) {
		const replyId = makeKey();
		const blocks: TranscriptMessage["blocks"] = text.trim() ? [{ kind: "text", text }] : [];
		setMessages((current) => [
			...current,
			{ id: makeKey(), role: "user", blocks, attachments },
			{ id: replyId, role: "assistant", blocks: [] },
		]);
		const body = { text, attachmentIds: attachments.map((attachment) => attachment.id) };
		void follow(replyId, (onEvent) => sendMessage(sessionId!, body, onEvent));
	}

	function retry() {
		const tail = messages.at(-1);
		const replyId = tail?.role === "assistant" ? tail.id : makeKey();
		setMessages((current) => {
			const last = current.at(-1);
			return last?.role === "assistant"
				? [...current.slice(0, -1), { ...last, notice: undefined, failed: undefined }]
				: [...current, { id: replyId, role: "assistant", blocks: [] }];
		});
		void follow(replyId, (onEvent) => retryRun(sessionId!, onEvent));
	}

	const stop = () => {
		if (sessionId) void abortRun(sessionId);
	};

	return { sessionId, messages, canRetry, usage, running, showView, showEmpty, send, retry, stop };
}
