import { cn } from "cn";
import type { ClipboardEvent, KeyboardEvent, RefObject } from "react";
import { Textarea } from "../components/textarea.tsx";
import { ComposerControls } from "./ComposerControls.tsx";
import { DraftChip } from "./DraftChip.tsx";
import type { Draft } from "./useDrafts.ts";

const CARD =
	"rounded-3xl border border-border bg-card pt-3.5 pr-3 pb-3 pl-[18px] focus-within:border-muted-foreground";

interface ComposerProps {
	text: string;
	onTextChange: (text: string) => void;
	textArea: RefObject<HTMLTextAreaElement | null>;
	isNewChat: boolean;
	drafts: Draft[];
	canAttach: boolean;
	canSend: boolean;
	running: boolean;
	/** The app can't reply yet, so the composer dims and takes no input. */
	dimmed: boolean;
	onAddFiles: (files: File[]) => void;
	onRemoveDraft: (key: string) => void;
	onSend: () => void;
	onStop: () => void;
}

export function Composer(props: ComposerProps) {
	const { text, onTextChange, textArea, isNewChat, drafts, canAttach, canSend, running } = props;
	const { dimmed, onAddFiles, onRemoveDraft, onSend, onStop } = props;

	function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
		if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
			event.preventDefault();
			onSend();
		}
	}

	function onPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
		const files = Array.from(event.clipboardData.files);
		if (files.length > 0) {
			event.preventDefault();
			onAddFiles(files);
		}
	}

	return (
		<form
			className="chat-column pt-1.5 pb-5"
			onSubmit={(event) => {
				event.preventDefault();
				onSend();
			}}
		>
			<div className={cn(CARD, dimmed && "opacity-50")}>
				{drafts.length > 0 && (
					<ul className="mb-3 flex [scrollbar-width:none] gap-2 overflow-x-auto">
						{drafts.map((draft) => (
							<DraftChip draft={draft} key={draft.key} onRemove={() => onRemoveDraft(draft.key)} />
						))}
					</ul>
				)}
				<Textarea
					ref={textArea}
					className="block max-h-[200px] min-h-0 resize-none rounded-none border-0 p-0 text-[15px] leading-[18px] transition-none focus-visible:ring-0 disabled:bg-transparent disabled:opacity-100"
					aria-label="Message"
					rows={1}
					disabled={dimmed}
					placeholder={isNewChat ? "Ask the tutor anything" : "Reply to the tutor"}
					value={text}
					onChange={(event) => onTextChange(event.target.value)}
					onKeyDown={onKeyDown}
					onPaste={onPaste}
					autoFocus
				/>
				<ComposerControls
					canAttach={canAttach}
					canSend={canSend}
					running={running}
					onAddFiles={onAddFiles}
					onStop={onStop}
				/>
			</div>
		</form>
	);
}
