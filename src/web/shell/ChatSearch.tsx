import { Search, X } from "lucide-react";
import { useRef } from "react";
import type { SnippetPart } from "../../shared/protocol.ts";
import { IconButton } from "../components/IconButton.tsx";
import { Input } from "../components/input.tsx";

export function ChatSearchField({
	value,
	onChange,
}: {
	value: string;
	onChange: (value: string) => void;
}) {
	const input = useRef<HTMLInputElement>(null);
	return (
		<div className="relative">
			<Search
				className="pointer-events-none absolute top-[9px] left-2.5 size-4 text-muted-foreground"
				strokeWidth={1.5}
			/>
			<Input
				ref={input}
				value={value}
				aria-label="Search chats"
				placeholder="Search chats"
				className="h-[34px] rounded-lg bg-transparent pr-8 pl-[33px] focus-visible:[border-width:1.5px] focus-visible:border-primary focus-visible:pr-[31.5px] focus-visible:pl-[32.5px]"
				onChange={(event) => onChange(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === "Escape") onChange("");
				}}
			/>
			{value && (
				<IconButton
					aria-label="Clear search"
					className="absolute top-[5px] right-1.5 size-6"
					onClick={() => {
						onChange("");
						input.current?.focus();
					}}
				>
					<X className="size-3.5" strokeWidth={1.5} />
				</IconButton>
			)}
		</div>
	);
}

/** One line of a result, with the matching words emphasised. */
export function ChatSnippet({ parts }: { parts: SnippetPart[] }) {
	return (
		<span className="block truncate text-[13px] leading-4 font-normal text-muted-foreground">
			{parts.map((part, index) =>
				part.match ? (
					<mark key={index} className="bg-transparent font-medium text-foreground">
						{part.text}
					</mark>
				) : (
					part.text
				),
			)}
		</span>
	);
}
