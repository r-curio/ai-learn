import { useCallback, useEffect, useState } from "react";
import type { EngineStatus, SessionSummary } from "../../shared/protocol.ts";
import { createSession, deleteSession, getSession, getStatus, listSessions } from "../api.ts";
import { useConversation } from "./useConversation.ts";

interface ChatOptions {
	/** The open chat changed, so the composer should clear. */
	onChatChange: () => void;
	/** The composer should take focus. */
	onReady: () => void;
}

/** App-level chat state: server status, saved chats, and switching between them. */
export function useChat({ onChatChange, onReady }: ChatOptions) {
	const [status, setStatus] = useState<EngineStatus>();
	const [sessions, setSessions] = useState<SessionSummary[]>([]);
	const [error, setError] = useState<string>();

	const refreshSessions = useCallback(() => {
		listSessions()
			.then(setSessions)
			.catch((cause: Error) => setError(cause.message));
	}, []);

	const conversation = useConversation(() => {
		refreshSessions();
		onReady();
	});
	const { sessionId, showEmpty, showView } = conversation;

	const startNewChat = useCallback(async () => {
		setError(undefined);
		showEmpty(await createSession());
		onChatChange();
		onReady();
	}, [onChatChange, onReady, showEmpty]);

	useEffect(() => {
		getStatus()
			.then(setStatus)
			.then(() => startNewChat())
			.then(refreshSessions)
			.catch((cause: Error) => setError(`Couldn't connect to the local server: ${cause.message}`));
	}, [refreshSessions, startNewChat]);

	async function openSession(id: string) {
		setError(undefined);
		try {
			showView(await getSession(id));
			onChatChange();
		} catch (cause) {
			setError(`Couldn't open that chat: ${(cause as Error).message}`);
		}
	}

	async function removeSession(summary: SessionSummary) {
		if (!window.confirm(`Delete "${summary.title}"? This can't be undone.`)) return;
		try {
			await deleteSession(summary.id);
			if (summary.id === sessionId) await startNewChat();
			refreshSessions();
		} catch (cause) {
			setError(`Couldn't delete that chat: ${(cause as Error).message}`);
		}
	}

	return { ...conversation, status, sessions, error, startNewChat, openSession, removeSession };
}
