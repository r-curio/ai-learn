import { ArrowUp, Plus } from "lucide-react";
import { useRef } from "react";
import { Button } from "../components/button.tsx";
import { IconButton } from "../components/IconButton.tsx";

interface ComposerControlsProps {
	canAttach: boolean;
	canSend: boolean;
	running: boolean;
	onAddFiles: (files: File[]) => void;
	onStop: () => void;
}

/** The row under the message box: Attach on the left, Send or Stop on the right. */
export function ComposerControls(props: ComposerControlsProps) {
	const { canAttach, canSend, running, onAddFiles, onStop } = props;
	const fileInput = useRef<HTMLInputElement>(null);

	return (
		<div className="mt-[22px] flex items-center justify-between">
			<IconButton
				aria-label="Attach files"
				// The plus sits centred in its hover shape, and the margin keeps it lined up with the text.
				className="-ml-[5px] size-8 p-0"
				disabled={!canAttach}
				onClick={() => fileInput.current?.click()}
			>
				<Plus className="size-5" strokeWidth={1.5} />
			</IconButton>
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
				<Button
					size="icon"
					aria-label="Stop reply"
					className="size-8 rounded-full p-0"
					onClick={onStop}
				>
					<span className="size-2.5 rounded-[2px] bg-primary-foreground" />
				</Button>
			) : (
				<Button
					size="icon"
					type="submit"
					aria-label="Send message"
					className="size-8 rounded-full p-0"
					disabled={!canSend}
				>
					<ArrowUp className="size-[18px]" strokeWidth={1.8} />
				</Button>
			)}
		</div>
	);
}
