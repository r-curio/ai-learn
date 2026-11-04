import { useRef, type ClipboardEvent, type KeyboardEvent, type RefObject } from "react";
import "./composer.css";
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
			className="composer column"
			onSubmit={(event) => {
				event.preventDefault();
				onSend();
			}}
		>
			{drafts.length > 0 && (
				<ul className="chips">
					{drafts.map((draft) => (
						<DraftChip draft={draft} key={draft.key} onRemove={() => onRemoveDraft(draft.key)} />
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
					onChange={(event) => onTextChange(event.target.value)}
					onKeyDown={onKeyDown}
					onPaste={onPaste}
					autoFocus
				/>
				<div className="composer-actions">
					<button
						type="button"
						className="button-quiet"
						disabled={!canAttach}
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
							onAddFiles(Array.from(event.target.files ?? []));
							event.target.value = "";
						}}
					/>
					{running ? (
						<button type="button" className="button-primary" onClick={onStop}>
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
	);
}
