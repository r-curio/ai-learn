import { useRef, type ClipboardEvent, type KeyboardEvent, type RefObject } from "react";
import { Button } from "../components/button.tsx";
import { Textarea } from "../components/textarea.tsx";
import { DraftChip } from "./DraftChip.tsx";
import type { Draft } from "./useDrafts.ts";

interface ComposerProps {
	text: string;
	onTextChange: (text: string) => void;
	textArea: RefObject<HTMLTextAreaElement | null>;
	drafts: Draft[];
	canAttach: boolean;
	canSend: boolean;
	running: boolean;
	onAddFiles: (files: File[]) => void;
	onRemoveDraft: (key: string) => void;
	onSend: () => void;
	onStop: () => void;
}

export function Composer(props: ComposerProps) {
	const { text, onTextChange, textArea, drafts, canAttach, canSend, running } = props;
	const { onAddFiles, onRemoveDraft, onSend, onStop } = props;
	const fileInput = useRef<HTMLInputElement>(null);

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
			className="chat-column pt-1.5 pb-[18px]"
			onSubmit={(event) => {
				event.preventDefault();
				onSend();
			}}
		>
			{drafts.length > 0 && (
				<ul className="mb-2 flex flex-wrap gap-2">
					{drafts.map((draft) => (
						<DraftChip draft={draft} key={draft.key} onRemove={() => onRemoveDraft(draft.key)} />
					))}
				</ul>
			)}
			<div className="rounded-[14px] border border-border bg-card px-3 pt-2.5 pb-2 focus-within:border-muted-foreground">
				<Textarea
					ref={textArea}
					className="block max-h-[200px] min-h-0 resize-none rounded-none border-0 p-0.5 text-[16px] transition-none focus-visible:ring-0"
					aria-label="Message"
					rows={2}
					placeholder="Message ai-learn"
					value={text}
					onChange={(event) => onTextChange(event.target.value)}
					onKeyDown={onKeyDown}
					onPaste={onPaste}
					autoFocus
				/>
				<div className="mt-1.5 flex items-center justify-between">
					<Button
						variant="outline"
						disabled={!canAttach}
						onClick={() => fileInput.current?.click()}
					>
						Attach
					</Button>
					<input
						ref={fileInput}
						type="file"
						multiple
						hidden
						onChange={(event) => {
							onAddFiles(Array.from(event.target.files ?? []));
							event.target.value = "";
						}}
					/>
					{running ? (
						<Button variant="default" onClick={onStop}>
							Stop
						</Button>
					) : (
						<Button variant="default" type="submit" disabled={!canSend}>
							Send
						</Button>
					)}
				</div>
			</div>
		</form>
	);
}
