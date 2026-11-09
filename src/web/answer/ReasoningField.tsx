import { cn } from "cn";
import type { KeyboardEvent, ReactNode } from "react";
import { Textarea } from "../components/form/textarea.tsx";

/** The learner's reasoning. While words are being spoken into it, it turns red and shows `recording`. */
export function ReasoningField({
	value,
	placeholder,
	recording,
	onChange,
	onSubmit,
}: {
	value: string;
	placeholder: string;
	recording?: ReactNode;
	onChange: (value: string) => void;
	onSubmit: () => void;
}) {
	const submitOnEnter = (event: KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
			event.preventDefault();
			onSubmit();
		}
	};
	return (
		<div
			className={cn(
				"flex flex-none items-center gap-2.5 rounded-lg border border-input px-3 transition-colors focus-within:border-muted-foreground",
				// The thicker red edge takes its half pixel from the padding, so nothing moves.
				recording &&
					"border-[1.5px] border-destructive px-[11.5px] focus-within:border-destructive",
			)}
		>
			<Textarea
				aria-label="Your reasoning"
				data-dictation="reasoning"
				rows={1}
				placeholder={placeholder}
				className={cn(
					"max-h-[124px] min-h-[42px] flex-1 resize-none rounded-none border-0 px-0 py-[11px] text-[14px] leading-5 focus-visible:ring-0",
					recording && "min-h-[41px] py-[10.5px]",
				)}
				value={value}
				onChange={(event) => onChange(event.target.value)}
				onKeyDown={submitOnEnter}
			/>
			{recording}
		</div>
	);
}
