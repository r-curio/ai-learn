import { Pencil, X } from "lucide-react";
import { Input } from "../components/form/input.tsx";
import { IconButton } from "../components/IconButton.tsx";

/** Tinted once the learner has finished typing, and plain while the box has the cursor. */
export function OwnAnswer({
	text,
	onTextChange,
	onClose,
}: {
	text: string;
	onTextChange: (text: string) => void;
	onClose: () => void;
}) {
	return (
		<div className="flex h-[38px] flex-none items-center gap-2.5 rounded-lg border-[1.5px] border-primary bg-accent px-3 transition-colors duration-150 focus-within:bg-transparent">
			<Pencil className="size-4 flex-none text-muted-foreground" strokeWidth={1.5} />
			<Input
				autoFocus
				aria-label="Your own answer"
				placeholder="Type your answer"
				className="h-5 flex-1 rounded-none border-0 bg-transparent px-0 leading-5"
				value={text}
				onChange={(event) => onTextChange(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === "Enter" && !event.nativeEvent.isComposing) {
						event.preventDefault();
						event.currentTarget.blur();
					}
				}}
			/>
			<IconButton aria-label="Remove your own answer" className="-mr-1 size-6" onClick={onClose}>
				<X className="size-4" strokeWidth={1.5} />
			</IconButton>
		</div>
	);
}
