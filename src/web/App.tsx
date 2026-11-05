import { useCallback, useRef, useState } from "react";
import { ChatView } from "./chat/ChatView.tsx";
import { useChat } from "./chat/useChat.ts";
import { Composer } from "./composer/Composer.tsx";
import { useDrafts } from "./composer/useDrafts.ts";
import { useFileDrop } from "./composer/useFileDrop.ts";
import { Sidebar } from "./Sidebar.tsx";
import { TopBar } from "./TopBar.tsx";

export function App() {
	const [text, setText] = useState("");
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const textArea = useRef<HTMLTextAreaElement>(null);
	const files = useDrafts();
	const { clearDrafts, addFiles } = files;

	const onChatChange = useCallback(() => {
		clearDrafts();
		setText("");
	}, [clearDrafts]);
	const onReady = useCallback(() => textArea.current?.focus(), []);
	const chat = useChat({ onChatChange, onReady });
	const { sessionId, status, running } = chat;

	const attach = useCallback(
		(dropped: File[]) => {
			if (sessionId) addFiles(sessionId, dropped);
		},
		[addFiles, sessionId],
	);
	const { dragging, dropHandlers } = useFileDrop(attach);
	const hasContent = Boolean(text.trim() || files.attachments.length > 0);
	const canSend = Boolean(sessionId && status?.ready && !running && !files.uploading && hasContent);

	function send() {
		if (!canSend) return;
		chat.send(text, files.attachments);
		setText("");
		clearDrafts();
	}

	return (
		<div className="relative flex h-full" {...dropHandlers}>
			<Sidebar
				open={sidebarOpen}
				sessions={chat.sessions}
				activeId={sessionId}
				disabled={running}
				onNewChat={() => {
					setSidebarOpen(false);
					void chat.startNewChat();
				}}
				onOpen={(id) => {
					setSidebarOpen(false);
					void chat.openSession(id);
				}}
				onDelete={(summary) => void chat.removeSession(summary)}
			/>
			<div className="flex min-w-0 flex-1 flex-col">
				<TopBar
					status={status}
					usage={chat.usage}
					sidebarOpen={sidebarOpen}
					onToggleSidebar={() => setSidebarOpen((open) => !open)}
				/>
				<ChatView
					status={status}
					error={chat.error}
					sessionId={sessionId}
					messages={chat.messages}
					running={running}
					canRetry={chat.canRetry}
					onRetry={() => {
						if (status?.ready && !running) chat.retry();
					}}
				/>
				<Composer
					text={text}
					onTextChange={setText}
					textArea={textArea}
					drafts={files.drafts}
					canAttach={Boolean(sessionId)}
					canSend={canSend}
					running={running}
					onAddFiles={attach}
					onRemoveDraft={files.removeDraft}
					onSend={send}
					onStop={chat.stop}
				/>
			</div>
			{dragging && (
				<div
					className="pointer-events-none absolute inset-2.5 grid place-items-center rounded-[14px] border-2 border-dashed border-primary bg-background/88 font-semibold"
					aria-hidden="true"
				>
					Drop files to attach
				</div>
			)}
		</div>
	);
}
