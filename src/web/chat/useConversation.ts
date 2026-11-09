import { useCallback, useState } from "react";
import {
	answerText,
	noticeFor,
	type AttachmentInfo,
	type ChatType,
	type ContextUsage,
	type ModelSelection,
	type OpenPage,
	type Question,
	type QuestionAnswer,
	type RunEvent,
	type SessionView,
	type TranscriptMessage,
	type UsageSummary,
} from "../../shared/protocol.ts";
import { abortRun, answerQuestion, getSession, retryRun, sendMessage } from "../api.ts";
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
	const [pendingQuestion, setPendingQuestion] = useState<Question>();
	const [refusedAnswer, setRefusedAnswer] = useState<{ answer: QuestionAnswer; message: string }>();
	const [running, setRunning] = useState(false);
	const [runStartedAt, setRunStartedAt] = useState(0);

	const showView = useCallback((view: SessionView) => {
		setSessionId(view.id);
		setMessages(view.messages);
		setCanRetry(view.canRetry);
		setUsage(view.usage);
		setContext(view.context);
		setPendingQuestion(view.pendingQuestion);
		setRefusedAnswer(undefined);
	}, []);

	const showEmpty = useCallback((id: string) => {
		setSessionId(id);
		setMessages([]);
		setCanRetry(false);
		setUsage(undefined);
		setContext(undefined);
		setPendingQuestion(undefined);
		setRefusedAnswer(undefined);
	}, []);

	const update = (id: string, change: (message: TranscriptMessage) => TranscriptMessage) =>
		setMessages((current) => current.map((item) => (item.id === id ? change(item) : item)));

	/** `recover` can take over from a failure, by returning true once it has put things right. */
	async function follow(
		replyId: string,
		startRun: StartRun,
		recover?: (message: string) => Promise<boolean>,
	) {
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
			if (await recover?.(notice)) return;
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
		viewing?: OpenPage,
	) {
		const replyId = makeKey();
		const blocks: TranscriptMessage["blocks"] = text.trim() ? [{ kind: "text", text }] : [];
		setMessages((current) => [
			...current,
			{ id: makeKey(), role: "user", blocks, attachments },
			{ id: replyId, role: "assistant", blocks: [] },
		]);
		// The type is always sent, since a first send that fails leaves nothing saved. The server ignores it after that.
		const body = {
			text,
			attachmentIds: attachments.map((attachment) => attachment.id),
			viewing,
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

	function answer(question: Question, given: QuestionAnswer, model: ModelSelection) {
		const replyId = makeKey();
		const answerId = makeKey();
		const text = answerText(question.choices, given);
		const id = sessionId!;
		setPendingQuestion(undefined);
		setRefusedAnswer(undefined);
		setMessages((current) => [
			...current,
			{
				id: answerId,
				role: "user",
				blocks: [{ kind: "text", text }],
				...("confidence" in given ? { confidence: given.confidence } : {}),
			},
			{ id: replyId, role: "assistant", blocks: [] },
		]);
		const body = { questionId: question.id, answer: given, model };
		// If the question is still waiting, nothing was saved, so the learner gets their card back.
		const bringBackCard = async (message: string) => {
			const view = await getSession(id).catch(() => undefined);
			if (view && view.pendingQuestion?.id !== question.id) return false;
			setMessages((current) => current.slice(0, -2));
			setPendingQuestion(question);
			setRefusedAnswer({ answer: given, message });
			return true;
		};
		// A quiz's grade belongs to the answer, and arrives before the tutor's reply starts.
		const showGrade = (event: RunEvent) => {
			const grade = event.type === "graded" && { ...event.grade, choices: question.choices };
			if (grade) update(answerId, (message) => ({ ...message, grade }));
			return Boolean(grade);
		};
		void follow(
			replyId,
			(onEvent) => answerQuestion(id, body, (event) => showGrade(event) || onEvent(event)),
			bringBackCard,
		);
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
		pendingQuestion,
		refusedAnswer,
		running,
		runStartedAt,
		showView,
		showEmpty,
		send,
		retry,
		answer,
		stop,
	};
}
