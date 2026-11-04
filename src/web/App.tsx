import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type ClipboardEvent,
	type DragEvent,
	type KeyboardEvent,
} from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
	noticeFor,
	type AttachmentInfo,
	type EngineStatus,
	type RunEvent,
	type SessionSummary,
	type TranscriptMessage,
	type UsageSummary,
} from "../shared/protocol.ts";
import {
	abortRun,
	createSession,
	deleteSession,
	fetchImageUrl,
	getSession,
	getStatus,
	listSessions,
	retryRun,
	sendMessage,
	uploadAttachment,
} from "./api.ts";

interface Draft {
	key: string;
	file: File;
	preview?: string;
	state: "uploading" | "ready" | "failed";
	info?: AttachmentInfo;
	error?: string;
}

let nextKey = 0;
const makeKey = () => `local-${++nextKey}`;

function formatSize(bytes: number): string {
	return bytes < 1024 * 1024
		? `${Math.max(1, Math.round(bytes / 1024))} KB`
		: `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatCost(usage: UsageSummary): string {
	return `${(usage.inputTokens + usage.outputTokens).toLocaleString()} tokens · $${usage.costUsd.toFixed(usage.costUsd < 1 ? 4 : 2)}`;
}

function SavedImage({ sessionId, attachment }: { sessionId: string; attachment: AttachmentInfo }) {
	const [url, setUrl] = useState<string>();
	const [failed, setFailed] = useState(false);
	useEffect(() => {
		let active = true;
		let created: string | undefined;
		fetchImageUrl(sessionId, attachment.id)
			.then((next) => {
				created = next;
				if (active) setUrl(next);
				else URL.revokeObjectURL(next);
			})
			.catch(() => active && setFailed(true));
		return () => {
			active = false;
			if (created) URL.revokeObjectURL(created);
		};
	}, [sessionId, attachment.id]);
	if (failed) return <span className="sent-file">{attachment.name}</span>;
	return url ? (
		<img src={url} alt={attachment.name} />
	) : (
		<span className="image-placeholder" aria-label={attachment.name} />
	);
}

function DraftChip({ draft, onRemove }: { draft: Draft; onRemove: () => void }) {
	return (
		<li className={`chip chip-${draft.state}`} title={draft.error}>
			{draft.preview ? (
				<img src={draft.preview} alt="" />
			) : (
				<span className="chip-type">
					{draft.file.name.split(".").at(-1)?.slice(0, 4) || "file"}
				</span>
			)}
			<span className="chip-text">
				<span className="chip-name">{draft.file.name}</span>
				<span className="chip-meta">
					{draft.state === "uploading"
						? "Reading…"
						: draft.state === "failed"
							? draft.error
							: formatSize(draft.file.size)}
				</span>
			</span>
			<button
				type="button"
				className="chip-remove"
				onClick={onRemove}
				aria-label={`Remove ${draft.file.name}`}
			>
				×
			</button>
		</li>
	);
}

function MessageView({
	message,
	sessionId,
	onRetry,
}: {
	message: TranscriptMessage;
	sessionId: string;
	onRetry?: () => void;
}) {
	return (
		<article className={`message message-${message.role}`}>
			{message.attachments && message.attachments.length > 0 && (
				<ul className="sent-attachments">
					{message.attachments.map((attachment) => (
						<li key={attachment.id}>
							{attachment.kind === "image" ? (
								<SavedImage sessionId={sessionId} attachment={attachment} />
							) : (
								<span className="sent-file">{attachment.name}</span>
							)}
						</li>
					))}
				</ul>
			)}
			{message.blocks.map((block, index) =>
				block.kind === "text" ? (
					message.role === "assistant" ? (
						<div className="prose" key={index}>
							<Markdown remarkPlugins={[remarkGfm]}>{block.text}</Markdown>
						</div>
					) : (
						<p className="user-text" key={index}>
							{block.text}
						</p>
					)
				) : (
					<p className={`tool tool-${block.state}`} key={block.id}>
						{block.label}
						{block.state === "running" ? "…" : block.state === "failed" ? " failed" : ""}
					</p>
				),
			)}
			{message.notice && (
				<p className={message.failed ? "notice notice-error" : "notice"}>
					{message.notice}
					{onRetry && (
						<button type="button" className="button-inline" onClick={onRetry}>
							Retry
						</button>
					)}
				</p>
			)}
		</article>
	);
}

export function App() {
	const [status, setStatus] = useState<EngineStatus>();
	const [sessions, setSessions] = useState<SessionSummary[]>([]);
	const [sessionId, setSessionId] = useState<string>();
	const [error, setError] = useState<string>();
	const [messages, setMessages] = useState<TranscriptMessage[]>([]);
	const [canRetry, setCanRetry] = useState(false);
	const [drafts, setDrafts] = useState<Draft[]>([]);
	const [text, setText] = useState("");
	const [running, setRunning] = useState(false);
	const [dragging, setDragging] = useState(false);
	const [usage, setUsage] = useState<UsageSummary>();
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const fileInput = useRef<HTMLInputElement>(null);
	const textArea = useRef<HTMLTextAreaElement>(null);
	const scroller = useRef<HTMLDivElement>(null);
	const dragDepth = useRef(0);

	const refreshSessions = useCallback(() => {
		listSessions()
			.then(setSessions)
			.catch((cause: Error) => setError(cause.message));
	}, []);

	const startNewChat = useCallback(async () => {
		setError(undefined);
		const id = await createSession();
		setSessionId(id);
		setMessages([]);
		setDrafts([]);
		setText("");
		setCanRetry(false);
		setUsage(undefined);
		setSidebarOpen(false);
		textArea.current?.focus();
	}, []);

	useEffect(() => {
		getStatus()
			.then(setStatus)
			.then(() => startNewChat())
			.then(refreshSessions)
			.catch((cause: Error) => setError(`Couldn't connect to the local server: ${cause.message}`));
	}, [refreshSessions, startNewChat]);

	useEffect(() => {
		const element = scroller.current;
		if (element) element.scrollTop = element.scrollHeight;
	}, [messages]);

	async function openSession(id: string) {
		setError(undefined);
		setSidebarOpen(false);
		try {
			const view = await getSession(id);
			setSessionId(view.id);
			setMessages(view.messages);
			setCanRetry(view.canRetry);
			setUsage(view.usage);
			setDrafts([]);
			setText("");
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

	const addFiles = useCallback(
		(files: File[]) => {
			if (!sessionId) return;
			for (const file of files) {
				const key = makeKey();
				const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
				setDrafts((current) => [...current, { key, file, preview, state: "uploading" }]);
				uploadAttachment(sessionId, file)
					.then((info) =>
						setDrafts((current) =>
							current.map((d) => (d.key === key ? { ...d, state: "ready", info } : d)),
						),
					)
					.catch((cause: Error) =>
						setDrafts((current) =>
							current.map((d) =>
								d.key === key ? { ...d, state: "failed", error: cause.message } : d,
							),
						),
					);
			}
		},
		[sessionId],
	);

	const removeDraft = (key: string) =>
		setDrafts((current) => current.filter((draft) => draft.key !== key));

	const ready = drafts.filter((draft) => draft.state === "ready");
	const uploading = drafts.some((draft) => draft.state === "uploading");
	const canSend = Boolean(
		sessionId && status?.ready && !running && !uploading && (text.trim() || ready.length > 0),
	);

	const updateMessage = (id: string, change: (message: TranscriptMessage) => TranscriptMessage) =>
		setMessages((current) =>
			current.map((message) => (message.id === id ? change(message) : message)),
		);

	/** Apply a run's events to one assistant message. The server's copy replaces it when the run ends. */
	async function follow(
		assistantId: string,
		run: (onEvent: (event: RunEvent) => void) => Promise<void>,
	) {
		const id = sessionId!;
		setRunning(true);
		setCanRetry(false);
		try {
			await run((event) => {
				if (event.type === "text_delta") {
					updateMessage(assistantId, (message) => {
						const last = message.blocks.at(-1);
						return last?.kind === "text"
							? {
									...message,
									blocks: [
										...message.blocks.slice(0, -1),
										{ kind: "text", text: last.text + event.delta },
									],
								}
							: { ...message, blocks: [...message.blocks, { kind: "text", text: event.delta }] };
					});
				} else if (event.type === "tool_start") {
					updateMessage(assistantId, (message) => ({
						...message,
						blocks: [
							...message.blocks,
							{ kind: "tool", id: event.id, label: event.label, state: "running" },
						],
					}));
				} else if (event.type === "tool_end") {
					updateMessage(assistantId, (message) => ({
						...message,
						blocks: message.blocks.map((block) =>
							block.kind === "tool" && block.id === event.id
								? { ...block, state: event.isError ? "failed" : "done" }
								: block,
						),
					}));
				} else {
					setUsage(event.sessionUsage);
					const ending = noticeFor(event.stopReason, event.errorMessage);
					if (ending) updateMessage(assistantId, (message) => ({ ...message, ...ending }));
				}
			});
			const view = await getSession(id);
			setMessages(view.messages);
			setCanRetry(view.canRetry);
			setUsage(view.usage);
		} catch (cause) {
			updateMessage(assistantId, (message) => ({
				...message,
				notice: (cause as Error).message,
				failed: true,
			}));
		} finally {
			setRunning(false);
			refreshSessions();
			textArea.current?.focus();
		}
	}

	function send() {
		if (!canSend || !sessionId) return;
		const body = { text, attachmentIds: ready.map((draft) => draft.info!.id) };
		const assistantId = makeKey();
		setMessages((current) => [
			...current,
			{
				id: makeKey(),
				role: "user",
				blocks: text.trim() ? [{ kind: "text", text }] : [],
				attachments: ready.map((draft) => draft.info!),
			},
			{ id: assistantId, role: "assistant", blocks: [] },
		]);
		setText("");
		setDrafts([]);
		void follow(assistantId, (onEvent) => sendMessage(sessionId, body, onEvent));
	}

	function retry() {
		if (!sessionId || running || !status?.ready) return;
		const tail = messages.at(-1);
		const assistantId = tail?.role === "assistant" ? tail.id : makeKey();
		setMessages((current) => {
			const last = current.at(-1);
			return last?.role === "assistant"
				? [...current.slice(0, -1), { ...last, notice: undefined, failed: undefined }]
				: [...current, { id: assistantId, role: "assistant", blocks: [] }];
		});
		void follow(assistantId, (onEvent) => retryRun(sessionId, onEvent));
	}

	function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
		if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
			event.preventDefault();
			send();
		}
	}

	function onPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
		const files = Array.from(event.clipboardData.files);
		if (files.length > 0) {
			event.preventDefault();
			addFiles(files);
		}
	}

	const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer.types).includes("Files");

	return (
		<div
			className={`app${sidebarOpen ? " sidebar-open" : ""}`}
			onDragEnter={(event) => {
				if (!hasFiles(event)) return;
				event.preventDefault();
				dragDepth.current += 1;
				setDragging(true);
			}}
			onDragOver={(event) => {
				if (hasFiles(event)) event.preventDefault();
			}}
			onDragLeave={(event) => {
				if (!hasFiles(event)) return;
				dragDepth.current -= 1;
				if (dragDepth.current <= 0) setDragging(false);
			}}
			onDrop={(event) => {
				if (!hasFiles(event)) return;
				event.preventDefault();
				dragDepth.current = 0;
				setDragging(false);
				addFiles(Array.from(event.dataTransfer.files));
			}}
		>
			<aside className="sidebar" aria-label="Chats">
				<div className="sidebar-head">
					<span className="brand">ai-learn</span>
					<button
						type="button"
						className="button-quiet"
						disabled={running}
						onClick={() => void startNewChat()}
					>
						New chat
					</button>
				</div>
				<ul className="session-list">
					{sessions.map((summary) => (
						<li
							key={summary.id}
							className={summary.id === sessionId ? "session session-active" : "session"}
						>
							<button
								type="button"
								className="session-open"
								disabled={running}
								onClick={() => void openSession(summary.id)}
								aria-current={summary.id === sessionId ? "true" : undefined}
							>
								{summary.title}
							</button>
							<button
								type="button"
								className="session-delete"
								disabled={running}
								onClick={() => void removeSession(summary)}
								aria-label={`Delete ${summary.title}`}
							>
								×
							</button>
						</li>
					))}
				</ul>
				{sessions.length === 0 && <p className="sidebar-empty">Your chats will appear here.</p>}
			</aside>

			<div className="workspace">
				<header className="topbar">
					<button
						type="button"
						className="button-quiet sidebar-toggle"
						onClick={() => setSidebarOpen((open) => !open)}
						aria-expanded={sidebarOpen}
					>
						Chats
					</button>
					<span className="meta">
						{status?.model}
						{usage ? ` · ${formatCost(usage)}` : ""}
					</span>
				</header>

				<div className="scroller" ref={scroller}>
					<main className="column" aria-live="polite">
						{error && <p className="notice notice-error">{error}</p>}
						{status && !status.ready && (
							<div className="setup">
								<h2>Add your API key to start</h2>
								<p>
									{status.reason} Add it to <code>.env.local</code> in the project folder, then
									restart the app.
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
									onRetry={
										canRetry && !running && index === messages.length - 1 ? retry : undefined
									}
								/>
							))}
						{running && messages.at(-1)?.blocks.length === 0 && (
							<p className="thinking">Thinking…</p>
						)}
					</main>
				</div>

				<form
					className="composer column"
					onSubmit={(event) => {
						event.preventDefault();
						send();
					}}
				>
					{drafts.length > 0 && (
						<ul className="chips">
							{drafts.map((draft) => (
								<DraftChip draft={draft} key={draft.key} onRemove={() => removeDraft(draft.key)} />
							))}
						</ul>
					)}
					<div className="composer-box">
						<textarea
							ref={textArea}
							aria-label="Message"
							rows={2}
							placeholder="Message ai-learn"
							value={text}
							onChange={(event) => setText(event.target.value)}
							onKeyDown={onKeyDown}
							onPaste={onPaste}
							autoFocus
						/>
						<div className="composer-actions">
							<button
								type="button"
								className="button-quiet"
								disabled={!sessionId}
								onClick={() => fileInput.current?.click()}
							>
								Attach
							</button>
							<input
								ref={fileInput}
								type="file"
								multiple
								hidden
								onChange={(event) => {
									addFiles(Array.from(event.target.files ?? []));
									event.target.value = "";
								}}
							/>
							{running ? (
								<button
									type="button"
									className="button-primary"
									onClick={() => sessionId && void abortRun(sessionId)}
								>
									Stop
								</button>
							) : (
								<button type="submit" className="button-primary" disabled={!canSend}>
									Send
								</button>
							)}
						</div>
					</div>
				</form>
			</div>

			{dragging && (
				<div className="drop-overlay" aria-hidden="true">
					Drop files to attach
				</div>
			)}
		</div>
	);
}
