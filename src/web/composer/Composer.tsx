import { cn } from "cn";
import { FileText } from "lucide-react";
import { useRef, type ClipboardEvent, type KeyboardEvent, type RefObject } from "react";
import type { ContextUsage, ProviderOption } from "../../shared/protocol.ts";
import { Textarea } from "../components/form/textarea.tsx";
import { useHoldToTalk } from "../voice/useHoldToTalk.ts";
import type { VoiceRecorder } from "../voice/useVoiceRecorder.ts";
import { VoiceNotice } from "../voice/VoiceNotice.tsx";
import { ComposerControls } from "./ComposerControls.tsx";
import { DraftChip } from "./DraftChip.tsx";
import type { Draft } from "./useDrafts.ts";
import type { ModelChoice } from "./useModelChoice.ts";

const CARD =
	"@container rounded-3xl border border-border bg-card pt-3.5 pr-3 pb-3 pl-[18px] focus-within:border-muted-foreground";

interface ComposerProps {
	text: string;
	onTextChange: (text: string) => void;
	textArea: RefObject<HTMLTextAreaElement | null>;
	isNewChat: boolean;
	drafts: Draft[];
	canAttach: boolean;
	canSend: boolean;
	running: boolean;
	providers: ProviderOption[];
	modelChoice: ModelChoice;
	context?: ContextUsage;
	onNewChat: () => void;
	onAddProvider: () => void;
	/** The app can't reply yet, so the composer dims and takes no input. */
	dimmed: boolean;
	/** Nothing can be written until a model is chosen. The model menu stays usable. */
	needsModel: boolean;
	/** It's coming back after the answer card, so it swaps in the same way. */
	swappingIn: boolean;
	onAddFiles: (files: File[]) => void;
	onRemoveDraft: (key: string) => void;
	onSend: () => void;
	onStop: () => void;
	/** The PDF page open in the attachment pane, which the tutor is told about. */
	openPage?: { name: string; page: number };
	voice: VoiceRecorder;
	onOpenVoiceSettings: () => void;
}

/** It tucks behind the card, which is why the card sits above it. */
function OpenPageTray({ name, page }: { name: string; page: number }) {
	return (
		<div className="mx-3.5 -mb-[26px] flex h-[60px] items-start gap-1.5 rounded-t-[14px] border border-border bg-rail px-3.5 pt-2 text-[12px] leading-4 text-muted-foreground">
			<FileText className="size-3.5 flex-none" strokeWidth={1.5} />
			<span className="truncate">
				{name} · page {page}
			</span>
		</div>
	);
}

function DraftList({ drafts, onRemove }: { drafts: Draft[]; onRemove: (key: string) => void }) {
	if (drafts.length === 0) return null;
	return (
		<ul className="mb-3 flex [scrollbar-width:none] gap-2 overflow-x-auto">
			{drafts.map((draft) => (
				<DraftChip draft={draft} key={draft.key} onRemove={() => onRemove(draft.key)} />
			))}
		</ul>
	);
}

const sendOnEnter = (onSend: () => void) => (event: KeyboardEvent<HTMLTextAreaElement>) => {
	if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
		event.preventDefault();
		onSend();
	}
};

const attachPastedFiles =
	(onAddFiles: (files: File[]) => void) => (event: ClipboardEvent<HTMLTextAreaElement>) => {
		const files = Array.from(event.clipboardData.files);
		if (files.length > 0) {
			event.preventDefault();
			onAddFiles(files);
		}
	};

export function Composer(props: ComposerProps) {
	const { text, onTextChange, textArea, isNewChat, drafts, canAttach, canSend, running } = props;
	const { providers, modelChoice, context, onNewChat, onAddProvider, dimmed, needsModel } = props;
	const { onAddFiles, onRemoveDraft, swappingIn, onSend, onStop, openPage, voice } = props;
	const card = useRef<HTMLDivElement>(null);
	useHoldToTalk({ voice, enabled: !dimmed && !needsModel, fallback: "composer" });
	const prompt = isNewChat ? "Ask the tutor anything" : "Reply to the tutor";

	return (
		<form
			className={cn(
				"chat-column pt-1.5 pb-5",
				swappingIn &&
					"animate-in duration-200 ease-fluid fade-in-0 motion-safe:slide-in-from-bottom-1",
			)}
			onSubmit={(event) => {
				event.preventDefault();
				onSend();
			}}
		>
			{openPage && <OpenPageTray {...openPage} />}
			<div ref={card} className={cn(CARD, "relative", dimmed && "opacity-50")}>
				<DraftList drafts={drafts} onRemove={onRemoveDraft} />
				<Textarea
					ref={textArea}
					className="block max-h-[200px] min-h-0 resize-none rounded-none border-0 p-0 text-[15px] leading-[18px] transition-none focus-visible:ring-0 disabled:bg-transparent disabled:opacity-100"
					aria-label="Message"
					data-dictation="composer"
					rows={1}
					disabled={dimmed || needsModel}
					placeholder={needsModel ? "Choose a model to start" : prompt}
					value={text}
					onChange={(event) => onTextChange(event.target.value)}
					onKeyDown={sendOnEnter(onSend)}
					onPaste={attachPastedFiles(onAddFiles)}
					autoFocus
				/>
				<VoiceNotice className="mt-3" voice={voice} onOpenSettings={props.onOpenVoiceSettings} />
				<ComposerControls
					canAttach={canAttach}
					canSend={canSend}
					running={running}
					providers={providers}
					modelChoice={modelChoice}
					context={context}
					card={card}
					onNewChat={onNewChat}
					menusDisabled={dimmed}
					onAddProvider={onAddProvider}
					onAddFiles={onAddFiles}
					onStop={onStop}
					voice={voice}
					voiceDisabled={dimmed || needsModel}
				/>
			</div>
		</form>
	);
}
