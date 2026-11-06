import { useCallback, useState } from "react";
import {
	noticeFor,
	type AttachmentInfo,
	type ChatType,
	type ContextUsage,
	type ModelSelection,
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

/** A retry replaces what the failed attempt wrote, so the new reply doesn't stream onto the end of it. */
function withoutFailedAttempt(blocks: TranscriptMessage["blocks"]): TranscriptMessage["blocks"] {
	const end = blocks.findLastIndex((block) => block.kind === "tool") + 1;
	return blocks.slice(0, end);
}

/** The server's copy of a finished reply keeps the streamed one's key, so its Activity block stays as the learner left it. */
function keepingReplyKey(view: SessionView, replyId: string): SessionView {
	const tail = view.messages.at(-1);
	if (tail?.role !== "assistant") return view;
	return { ...view, messages: [...view.messages.slice(0, -1), { ...tail, id: replyId }] };
}

/** The open chat: its messages, and sending to it. `onRunEnd` fires after each reply finishes. */
export function useConversation(onRunEnd: () => void) {
	const [sessionId, setSessionId] = useState<string>();
	const [messages, setMessages] = useState<TranscriptMessage[]>([]);
	const [canRetry, setCanRetry] = useState(false);
	const [usage, setUsage] = useState<UsageSummary>();
	const [context, setContext] = useState<ContextUsage>();
	const [running, setRunning] = useState(false);
	const [runStartedAt, setRunStartedAt] = useState(0);

	const showView = useCallback((view: SessionView) => {
		setSessionId(view.id);
		setMessages(view.messages);
		setCanRetry(view.canRetry);
		setUsage(view.usage);
		setContext(view.context);
	}, []);

	const showEmpty = useCallback((id: string) => {
		setSessionId(id);
		setMessages([]);
		setCanRetry(false);
		setUsage(undefined);
		setContext(undefined);
	}, []);

	const update = (id: string, change: (message: TranscriptMessage) => TranscriptMessage) =>
		setMessages((current) => current.map((item) => (item.id === id ? change(item) : item)));

	async function follow(replyId: string, startRun: StartRun) {
		const id = sessionId!;
		setRunning(true);
		setRunStartedAt(Date.now());
		setCanRetry(false);
		try {
			await startRun((event) => {
				if (event.type === "done") {
					setUsage(event.sessionUsage);
					if (event.context) setContext(event.context);
					const ending = noticeFor(event.stopReason, event.errorMessage);
					if (ending) update(replyId, (message) => ({ ...message, ...ending }));
				} else {
					update(replyId, (message) => applyRunEvent(message, event));
				}
			});
			showView(keepingReplyKey(await getSession(id), replyId));
		} catch (cause) {
			const notice = (cause as Error).message;
			update(replyId, (message) => ({ ...message, notice, failed: true }));
		} finally {
			setRunning(false);
			onRunEnd();
		}
	}

	function send(
		text: string,
		attachments: AttachmentInfo[],
		model: ModelSelection,
		chatType: ChatType,
	) {
		const replyId = makeKey();
		const blocks: TranscriptMessage["blocks"] = text.trim() ? [{ kind: "text", text }] : [];
		setMessages((current) => [
			...current,
			{ id: makeKey(), role: "user", blocks, attachments },
			{ id: replyId, role: "assistant", blocks: [] },
		]);
		// Always sent, since a first send that fails leaves nothing saved. The server ignores it after that.
		const body = {
			text,
			attachmentIds: attachments.map((attachment) => attachment.id),
			model,
			chatType,
		};
		void follow(replyId, (onEvent) => sendMessage(sessionId!, body, onEvent));
	}

	function retry(model: ModelSelection) {
		const tail = messages.at(-1);
		const replyId = tail?.role === "assistant" ? tail.id : makeKey();
		setMessages((current) => {
			const last = current.at(-1);
			return last?.role === "assistant"
				? [
						...current.slice(0, -1),
						{
							...last,
							blocks: last.failed ? withoutFailedAttempt(last.blocks) : last.blocks,
							notice: undefined,
							failed: undefined,
							workedMs: undefined,
						},
					]
				: [...current, { id: replyId, role: "assistant", blocks: [] }];
		});
		void follow(replyId, (onEvent) => retryRun(sessionId!, model, onEvent));
	}

	const stop = () => {
		if (sessionId) void abortRun(sessionId);
	};

	return {
		sessionId,
		messages,
		canRetry,
		usage,
		context,
		running,
		runStartedAt,
		showView,
		showEmpty,
		send,
		retry,
		stop,
	};
}
