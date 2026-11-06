import { useCallback, useEffect, useRef, useState } from "react";
import { ChatView } from "./chat/ChatView.tsx";
import { useChat } from "./chat/useChat.ts";
import { Composer } from "./composer/Composer.tsx";
import { useDrafts } from "./composer/useDrafts.ts";
import { useFileDrop } from "./composer/useFileDrop.ts";
import { useModelChoice } from "./composer/useModelChoice.ts";
import { SidebarInset, SidebarProvider } from "./components/sidebar.tsx";
import { ChatSidebar } from "./shell/ChatSidebar.tsx";
import { ProvidersView } from "./settings/ProvidersView.tsx";
import { useProviders } from "./settings/useProviders.ts";
import { Rail, type RailView } from "./shell/Rail.tsx";
import { TopBar } from "./shell/TopBar.tsx";
import { useSidebarPreference } from "./shell/useSidebarPreference.ts";

export function App() {
	const [text, setText] = useState("");
	const sidebar = useSidebarPreference();
	const textArea = useRef<HTMLTextAreaElement>(null);
	const files = useDrafts();
	const [view, setView] = useState<RailView>("chat");
	const { clearDrafts, addFiles } = files;

	const onChatChange = useCallback(() => {
		clearDrafts();
		setText("");
	}, [clearDrafts]);
	const onReady = useCallback(() => textArea.current?.focus(), []);
	const chat = useChat({ onChatChange, onReady });
	const { sessionId, status, running } = chat;
	const modelChoice = useModelChoice(status, onReady);
	const hasModel = Boolean(modelChoice.selection);
	const providers = useProviders(status, chat.refreshStatus);
	const setupNeeded = status?.ready === false;

	const attach = useCallback(
		(dropped: File[]) => {
			if (sessionId && !setupNeeded && hasModel) addFiles(sessionId, dropped);
		},
		[addFiles, sessionId, setupNeeded, hasModel],
	);
	const { dragging, dropHandlers } = useFileDrop(attach);
	const hasContent = Boolean(text.trim() || files.attachments.length > 0);
	const canSend = Boolean(
		sessionId && status?.ready && hasModel && !running && !files.uploading && hasContent,
	);

	// The box can't hold focus while it's disabled, so give it focus once a saved model has loaded.
	useEffect(() => {
		if (hasModel) textArea.current?.focus();
	}, [hasModel]);

	function send() {
		if (!canSend || !modelChoice.selection) return;
		chat.send(text, files.attachments, modelChoice.selection);
		setText("");
		clearDrafts();
	}

	const { setOpen: saveSidebarOpen } = sidebar;
	const onSidebarChange = useCallback(
		(open: boolean) => {
			saveSidebarOpen(open);
			// The button just pressed may have moved off-screen, so keep the keyboard somewhere useful.
			textArea.current?.focus();
		},
		[saveSidebarOpen],
	);

	// Wait for the saved setting, so a collapsed sidebar doesn't flash open at launch.
	if (sidebar.open === undefined) return null;

	return (
		<SidebarProvider
			className="relative"
			open={sidebar.open}
			onOpenChange={onSidebarChange}
			{...(view === "chat" ? dropHandlers : {})}
		>
			<Rail view={view} onViewChange={setView} />
			{view === "chat" && (
				<ChatSidebar
					sessions={chat.sessions}
					activeId={sessionId}
					onNewChatScreen={chat.messages.length === 0}
					disabled={running}
					onNewChat={() => void chat.startNewChat()}
					onOpen={(id) => void chat.openSession(id)}
					onDelete={(summary) => void chat.removeSession(summary)}
				/>
			)}
			<SidebarInset>
				{view === "settings" ? (
					<ProvidersView
						connected={providers.connected}
						available={providers.available}
						keysUnavailable={status?.keysUnavailable}
						onConnect={providers.connect}
						onDisconnect={providers.disconnect}
					/>
				) : (
					<>
						<TopBar
							title={chat.sessions.find((summary) => summary.id === sessionId)?.title}
							usage={chat.usage}
						/>
						<ChatView
							status={status}
							error={chat.error}
							sessionId={sessionId}
							messages={chat.messages}
							running={running}
							runStartedAt={chat.runStartedAt}
							canRetry={chat.canRetry}
							onRetry={() => {
								if (!status?.ready || running) return;
								if (modelChoice.selection) chat.retry(modelChoice.selection);
								else modelChoice.setPickerOpen(true);
							}}
						/>
						<Composer
							text={text}
							onTextChange={setText}
							textArea={textArea}
							isNewChat={chat.messages.length === 0}
							drafts={files.drafts}
							canAttach={Boolean(sessionId) && !setupNeeded && hasModel}
							canSend={canSend}
							running={running}
							providers={status?.providers ?? []}
							modelChoice={modelChoice}
							onAddProvider={() => setView("settings")}
							dimmed={setupNeeded}
							needsModel={!setupNeeded && !hasModel}
							onAddFiles={attach}
							onRemoveDraft={files.removeDraft}
							onSend={send}
							onStop={chat.stop}
						/>
					</>
				)}
			</SidebarInset>
			{dragging && !setupNeeded && (
				<div
					className="pointer-events-none absolute inset-2.5 grid place-items-center rounded-[14px] border-2 border-dashed border-primary bg-background/88 font-semibold"
					aria-hidden="true"
				>
					Drop files to attach
				</div>
			)}
		</SidebarProvider>
	);
}
