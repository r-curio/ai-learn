import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AttachmentInfo, EngineStatus, UsageSummary } from "../shared/protocol.ts";
import { abortRun, createSession, getStatus, sendMessage, uploadAttachment } from "./api.ts";

type Block =
	| { kind: "text"; text: string }
	| { kind: "tool"; id: string; label: string; state: "running" | "done" | "failed" };

interface Draft {
	key: string;
	file: File;
	preview?: string;
	state: "uploading" | "ready" | "failed";
	info?: AttachmentInfo;
	error?: string;
}

interface Message {
	key: string;
	role: "user" | "assistant";
	blocks: Block[];
	attachments?: { name: string; kind: string; preview?: string }[];
	notice?: string;
	failed?: boolean;
}

let nextKey = 0;
const makeKey = () => String(++nextKey);

function formatSize(bytes: number): string {
	return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatCost(usage: UsageSummary): string {
	return `${(usage.inputTokens + usage.outputTokens).toLocaleString()} tokens · $${usage.costUsd.toFixed(usage.costUsd < 1 ? 4 : 2)}`;
}

function DraftChip({ draft, onRemove }: { draft: Draft; onRemove: () => void }) {
	return (
		<li className={`chip chip-${draft.state}`} title={draft.error}>
			{draft.preview ? <img src={draft.preview} alt="" /> : <span className="chip-type">{draft.file.name.split(".").at(-1)?.slice(0, 4) || "file"}</span>}
			<span className="chip-text">
				<span className="chip-name">{draft.file.name}</span>
				<span className="chip-meta">
					{draft.state === "uploading" ? "Reading…" : draft.state === "failed" ? draft.error : formatSize(draft.file.size)}
				</span>
			</span>
			<button type="button" className="chip-remove" onClick={onRemove} aria-label={`Remove ${draft.file.name}`}>
				×
			</button>
		</li>
	);
}

function MessageView({ message }: { message: Message }) {
	return (
		<article className={`message message-${message.role}`}>
			{message.attachments && message.attachments.length > 0 && (
				<ul className="sent-attachments">
					{message.attachments.map((attachment, index) => (
						<li key={index}>
							{attachment.preview ? <img src={attachment.preview} alt={attachment.name} /> : <span className="sent-file">{attachment.name}</span>}
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
			{message.notice && <p className={message.failed ? "notice notice-error" : "notice"}>{message.notice}</p>}
		</article>
	);
}

export function App() {
	const [status, setStatus] = useState<EngineStatus>();
	const [sessionId, setSessionId] = useState<string>();
	const [startupError, setStartupError] = useState<string>();
	const [messages, setMessages] = useState<Message[]>([]);
	const [drafts, setDrafts] = useState<Draft[]>([]);
	const [text, setText] = useState("");
	const [running, setRunning] = useState(false);
	const [dragging, setDragging] = useState(false);
	const [usage, setUsage] = useState<UsageSummary>();
	const fileInput = useRef<HTMLInputElement>(null);
	const textArea = useRef<HTMLTextAreaElement>(null);
	const scroller = useRef<HTMLDivElement>(null);
	const dragDepth = useRef(0);

	useEffect(() => {
		let active = true;
		Promise.all([getStatus(), createSession()])
			.then(([nextStatus, id]) => {
				if (!active) return;
				setStatus(nextStatus);
				setSessionId(id);
			})
			.catch((error: Error) => active && setStartupError(error.message));
		return () => {
			active = false;
		};
	}, []);

	useEffect(() => {
		const element = scroller.current;
		if (element) element.scrollTop = element.scrollHeight;
	}, [messages]);

	const addFiles = useCallback(
		(files: File[]) => {
			if (!sessionId) return;
			for (const file of files) {
				const key = makeKey();
				const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
				setDrafts((current) => [...current, { key, file, preview, state: "uploading" }]);
				uploadAttachment(sessionId, file)
					.then((info) => setDrafts((current) => current.map((d) => (d.key === key ? { ...d, state: "ready", info } : d))))
					.catch((error: Error) =>
						setDrafts((current) => current.map((d) => (d.key === key ? { ...d, state: "failed", error: error.message } : d))),
					);
			}
		},
		[sessionId],
	);

	const removeDraft = (key: string) => setDrafts((current) => current.filter((draft) => draft.key !== key));

	const ready = drafts.filter((draft) => draft.state === "ready");
	const uploading = drafts.some((draft) => draft.state === "uploading");
	const canSend = Boolean(sessionId && status?.ready && !running && !uploading && (text.trim() || ready.length > 0));

	const updateAssistant = (key: string, change: (message: Message) => Message) =>
		setMessages((current) => current.map((message) => (message.key === key ? change(message) : message)));

	async function send() {
		if (!canSend || !sessionId) return;
		const body = { text, attachmentIds: ready.map((draft) => draft.info!.id) };
		const assistantKey = makeKey();
		setMessages((current) => [
			...current,
			{
				key: makeKey(),
				role: "user",
				blocks: text.trim() ? [{ kind: "text", text }] : [],
				attachments: ready.map((draft) => ({ name: draft.file.name, kind: draft.info!.kind, preview: draft.preview })),
			},
			{ key: assistantKey, role: "assistant", blocks: [] },
		]);
		setText("");
		setDrafts([]);
		setRunning(true);
		try {
			await sendMessage(sessionId, body, (event) => {
				if (event.type === "text_delta") {
					updateAssistant(assistantKey, (message) => {
						const last = message.blocks.at(-1);
						return last?.kind === "text"
							? { ...message, blocks: [...message.blocks.slice(0, -1), { kind: "text", text: last.text + event.delta }] }
							: { ...message, blocks: [...message.blocks, { kind: "text", text: event.delta }] };
					});
				} else if (event.type === "tool_start") {
					updateAssistant(assistantKey, (message) => ({
						...message,
						blocks: [...message.blocks, { kind: "tool", id: event.id, label: event.label, state: "running" }],
					}));
				} else if (event.type === "tool_end") {
					updateAssistant(assistantKey, (message) => ({
						...message,
						blocks: message.blocks.map((block) =>
							block.kind === "tool" && block.id === event.id ? { ...block, state: event.isError ? "failed" : "done" } : block,
						),
					}));
				} else {
					setUsage(event.sessionUsage);
					updateAssistant(assistantKey, (message) => {
						if (event.stopReason === "aborted") return { ...message, notice: "Stopped." };
						if (event.stopReason === "length") return { ...message, notice: "This reply hit the length limit and was cut off." };
						if (event.stopReason === "stop" || event.stopReason === "toolUse") return message;
						return { ...message, notice: event.errorMessage ?? "The response failed.", failed: true };
					});
				}
			});
		} catch (error) {
			updateAssistant(assistantKey, (message) => ({ ...message, notice: (error as Error).message, failed: true }));
		} finally {
			setRunning(false);
			textArea.current?.focus();
		}
	}

	function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
		if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
			event.preventDefault();
			void send();
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
			className="app"
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
			<header className="topbar">
				<span className="brand">ai-learn</span>
				<span className="meta">
					{status?.model}
					{usage ? ` · ${formatCost(usage)}` : ""}
				</span>
			</header>

			<div className="scroller" ref={scroller}>
				<main className="column" aria-live="polite">
					{startupError && <p className="notice notice-error">Couldn't connect to the local server: {startupError}</p>}
					{status && !status.ready && (
						<div className="setup">
							<h2>Add your API key to start</h2>
							<p>{status.reason} Add it to <code>.env.local</code> in the project folder, then restart the app.</p>
						</div>
					)}
					{messages.length === 0 && status?.ready && (
						<div className="empty">
							<h1>What do you want to understand?</h1>
							<p>Ask a question, or add images, PDFs, and text files.</p>
						</div>
					)}
					{messages.map((message) => (
						<MessageView message={message} key={message.key} />
					))}
					{running && messages.at(-1)?.blocks.length === 0 && <p className="thinking">Thinking…</p>}
				</main>
			</div>

			<form
				className="composer column"
				onSubmit={(event) => {
					event.preventDefault();
					void send();
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
						<button type="button" className="button-quiet" disabled={!sessionId} onClick={() => fileInput.current?.click()}>
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
							<button type="button" className="button-primary" onClick={() => sessionId && void abortRun(sessionId)}>
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

			{dragging && (
				<div className="drop-overlay" aria-hidden="true">
					Drop files to attach
				</div>
			)}
		</div>
	);
}
