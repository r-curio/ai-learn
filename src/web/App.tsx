import { cn } from "cn";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { ChatType } from "../shared/protocol.ts";
import { AnswerCard } from "./answer/AnswerCard.tsx";
import { ChatView } from "./chat/ChatView.tsx";
import { useChat } from "./chat/useChat.ts";
import { Composer } from "./composer/Composer.tsx";
import { useDrafts } from "./composer/useDrafts.ts";
import { useFileDrop } from "./composer/useFileDrop.ts";
import { DrawingEditor } from "./diagram/DrawingEditor.tsx";
import { useDrawingEdit } from "./diagram/useDrawingEdit.ts";
import { useModelChoice } from "./composer/useModelChoice.ts";
import { SidebarInset, SidebarProvider } from "./components/sidebar.tsx";
import { ChatSidebar } from "./shell/ChatSidebar.tsx";
import { SettingsView, type SettingsPage } from "./settings/SettingsView.tsx";
import { useProviders } from "./settings/useProviders.ts";
import { Rail, type RailView } from "./shell/Rail.tsx";
import { TopBar } from "./shell/TopBar.tsx";
import { WindowBar } from "./shell/WindowBar.tsx";
import { useSidebarPreference } from "./shell/useSidebarPreference.ts";
import { AttachmentPane } from "./viewer/AttachmentPane.tsx";
import { useAttachmentPane } from "./viewer/useAttachmentPane.ts";
import { addWords, useVoiceRecorder } from "./voice/useVoiceRecorder.ts";

/** The sidebar narrows while an attachment is open, to leave room for the chat and the page. */
const NARROW_SIDEBAR = { "--sidebar-width": "216px" } as CSSProperties;

export function App() {
	const [text, setText] = useState("");
	const sidebar = useSidebarPreference();
	const textArea = useRef<HTMLTextAreaElement>(null);
	const files = useDrafts();
	const [view, setView] = useState<RailView>("chat");
	const [settingsPage, setSettingsPage] = useState<SettingsPage>("providers");
	const [chatType, setChatType] = useState<ChatType>("learning");
	const { clearDrafts, addFiles } = files;
	const drawingEdit = useDrawingEdit();
	const { clear: clearEdit } = drawingEdit;
	const pane = useAttachmentPane();
	const { close: closePane } = pane;

	const onChatChange = useCallback(() => {
		clearDrafts();
		clearEdit();
		setText("");
		setChatType("learning");
		closePane();
	}, [clearDrafts, clearEdit, closePane]);
	const onReady = useCallback(() => textArea.current?.focus(), []);
	const chat = useChat({ onChatChange, onReady });
	const { sessionId, status, running } = chat;
	const modelChoice = useModelChoice(status, onReady);
	const hasModel = Boolean(modelChoice.selection);
	const providers = useProviders(status, chat.refreshStatus);
	const voice = useVoiceRecorder(status?.voice ?? [], (words) =>
		setText((current) => addWords(current, words)),
	);
	// Words from one chat's recording never land in another chat's box.
	const { cancel: cancelVoice } = voice;
	useEffect(() => cancelVoice(), [sessionId, cancelVoice]);
	const setupNeeded = status?.ready === false;
	const waitingQuestion = running ? undefined : chat.pendingQuestion;
	const [cardHasShown, setCardHasShown] = useState(false);
	if (waitingQuestion && !cardHasShown) setCardHasShown(true);
	const canAddFiles = Boolean(sessionId && !setupNeeded && hasModel && !waitingQuestion);

	const attach = useCallback(
		(dropped: File[]) => {
			if (sessionId && canAddFiles) addFiles(sessionId, dropped);
		},
		[addFiles, sessionId, canAddFiles],
	);
	const { dragging, dropHandlers } = useFileDrop(attach);
	const hasContent = Boolean(text.trim() || files.attachments.length > 0 || drawingEdit.edit);
	// Recording never sends, and the last words must arrive before the message can go.
	const canSend = Boolean(
		sessionId &&
		status?.ready &&
		hasModel &&
		!running &&
		!files.uploading &&
		!drawingEdit.uploading &&
		// A failed picture must be removed or redone, or the edit would quietly go unsent.
		drawingEdit.draft?.state !== "failed" &&
		!voice.busy &&
		hasContent,
	);

	// The box can't hold focus while it's disabled, so give it focus once a saved model has loaded.
	useEffect(() => {
		if (hasModel) textArea.current?.focus();
	}, [hasModel]);

	// The tray and the tutor only know about a PDF once its first page has been measured.
	const openPdf = pane.open && pane.target?.attachment.kind === "pdf" ? pane.target : undefined;
	const openPage = openPdf && pane.page ? pane.page : undefined;

	function send() {
		if (!canSend || !modelChoice.selection) return;
		const viewing =
			openPdf && openPage ? { attachmentId: openPdf.attachment.id, page: openPage } : undefined;
		chat.send(text, files.attachments, modelChoice.selection, chatType, viewing, drawingEdit.edit);
		setText("");
		clearDrafts();
		clearEdit();
		voice.dismiss();
	}

	function openVoiceSettings() {
		setSettingsPage("voice");
		setView("settings");
	}

	function openProviders() {
		setSettingsPage("providers");
		setView("settings");
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
			style={pane.open && view === "chat" ? NARROW_SIDEBAR : undefined}
			open={sidebar.open}
			onOpenChange={onSidebarChange}
			{...(view === "chat" ? dropHandlers : {})}
		>
			<WindowBar />
			<div className="flex min-h-0 flex-1 bg-rail">
				<Rail view={view} onViewChange={setView} />
				<div className="relative flex min-w-0 flex-1 overflow-hidden rounded-tl-xl border-t border-l border-border">
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
							<SettingsView
								status={status}
								providers={providers}
								page={settingsPage}
								onPageChange={setSettingsPage}
							/>
						) : (
							<div className="flex min-h-0 flex-1">
								<div
									data-compact={pane.open || undefined}
									className={cn("flex min-w-0 flex-1 flex-col", pane.open && "max-[1100px]:hidden")}
								>
									<TopBar
										title={chat.sessions.find((summary) => summary.id === sessionId)?.title}
										usage={pane.open ? undefined : chat.usage}
									/>
									<ChatView
										status={status}
										error={chat.error}
										sessionId={sessionId}
										messages={chat.messages}
										onEditDrawing={
											canAddFiles && !running
												? (callId, drawing) => drawingEdit.start(sessionId!, callId, drawing)
												: undefined
										}
										running={running}
										runStartedAt={chat.runStartedAt}
										canRetry={chat.canRetry}
										pendingQuestionId={waitingQuestion?.id}
										chatType={chatType}
										onChatTypeChange={setChatType}
										onRetry={() => {
											if (!status?.ready || running) return;
											if (modelChoice.selection) chat.retry(modelChoice.selection);
											else modelChoice.setPickerOpen(true);
										}}
										onOpenAttachment={(attachment) => {
											if (sessionId) pane.show({ sessionId, attachment });
										}}
										onOpenCitation={(citation) => {
											const attachment = chat.messages
												.flatMap((message) => message.attachments ?? [])
												.find(({ id }) => id === citation.attachmentId);
											if (sessionId && attachment)
												pane.show({ sessionId, attachment, citation: { ...citation } });
										}}
									/>
									{waitingQuestion ? (
										<AnswerCard
											key={waitingQuestion.id}
											question={waitingQuestion}
											refused={chat.refusedAnswer}
											dimmed={setupNeeded}
											providers={status?.providers ?? []}
											modelChoice={modelChoice}
											context={chat.context}
											onSubmit={(answer) => {
												if (modelChoice.selection)
													chat.answer(waitingQuestion, answer, modelChoice.selection);
												else modelChoice.setPickerOpen(true);
											}}
											onNewChat={() => void chat.startNewChat()}
											onAddProvider={openProviders}
											voiceEngines={status?.voice ?? []}
											onOpenVoiceSettings={openVoiceSettings}
										/>
									) : (
										<Composer
											text={text}
											onTextChange={setText}
											textArea={textArea}
											isNewChat={chat.messages.length === 0}
											drafts={files.drafts}
											edit={
												drawingEdit.draft && {
													draft: drawingEdit.draft,
													onRemove: drawingEdit.remove,
												}
											}
											canAttach={canAddFiles}
											canSend={canSend}
											running={running}
											providers={status?.providers ?? []}
											modelChoice={modelChoice}
											context={chat.context}
											onNewChat={() => void chat.startNewChat()}
											onAddProvider={openProviders}
											voice={voice}
											onOpenVoiceSettings={openVoiceSettings}
											dimmed={setupNeeded}
											needsModel={!setupNeeded && !hasModel}
											swappingIn={cardHasShown}
											onAddFiles={attach}
											onRemoveDraft={files.removeDraft}
											onSend={send}
											onStop={chat.stop}
											openPage={
												openPdf && openPage
													? { name: openPdf.attachment.name, page: openPage }
													: undefined
											}
										/>
									)}
								</div>
								<DrawingEditor {...drawingEdit.editor} />
								<AttachmentPane
									target={pane.target}
									open={pane.open}
									usage={chat.usage}
									onPageChange={pane.setPage}
									onClose={() => {
										pane.close();
										textArea.current?.focus();
									}}
								/>
							</div>
						)}
					</SidebarInset>
				</div>
			</div>
			{dragging && canAddFiles && (
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
