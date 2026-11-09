import { cn } from "cn";
import { Loader2, PenLine, X } from "lucide-react";
import { IconButton } from "../components/IconButton.tsx";
import type { EditDraft } from "./useDrawingEdit.ts";

/** The learner's edit, waiting in the composer like an attached file. */
export function EditChip({ draft, onRemove }: { draft: EditDraft; onRemove: () => void }) {
	const failed = draft.state === "failed";
	const name = `Edited: ${draft.title}`;
	return (
		<li
			className={cn(
				"group relative flex h-[122px] w-40 shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-muted",
				failed && "border-destructive",
			)}
			title={draft.error ?? name}
		>
			{failed ? (
				<p className="min-h-0 flex-1 overflow-hidden p-2.5 pr-8 text-[13px] leading-4 wrap-anywhere text-destructive">
					{draft.error}
				</p>
			) : (
				<span className="grid min-h-0 flex-1 place-items-center bg-background text-muted-foreground">
					<PenLine className="size-6" strokeWidth={1.5} />
				</span>
			)}
			<div className="flex h-8 flex-none items-center gap-1.5 px-2 text-[13px]">
				<PenLine className="size-4 flex-none text-muted-foreground" strokeWidth={1.5} />
				<span className="truncate">{name}</span>
			</div>
			{draft.state === "uploading" && (
				<div
					className="absolute inset-0 grid place-items-center bg-background/60"
					role="status"
					aria-label={`Saving a picture of ${draft.title}`}
				>
					<Loader2 className="size-5 motion-safe:animate-spin" strokeWidth={1.5} />
				</div>
			)}
			<IconButton
				className={cn(
					"absolute top-1 right-1 size-6 rounded-full border-border bg-popover p-0 text-foreground transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-muted [@media(hover:none)]:opacity-100",
					failed ? "opacity-100" : "opacity-0",
				)}
				onClick={onRemove}
				aria-label={`Remove your edit of ${draft.title}`}
			>
				<X className="size-3.5" strokeWidth={1.5} />
			</IconButton>
		</li>
	);
}
