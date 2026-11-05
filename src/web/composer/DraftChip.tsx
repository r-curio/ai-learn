import { IconButton } from "../components/IconButton.tsx";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemMedia,
	ItemTitle,
} from "../components/item.tsx";
import type { Draft } from "./useDrafts.ts";

function formatSize(bytes: number): string {
	return bytes < 1024 * 1024
		? `${Math.max(1, Math.round(bytes / 1024))} KB`
		: `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DraftChip({ draft, onRemove }: { draft: Draft; onRemove: () => void }) {
	const failed = draft.state === "failed";
	return (
		<li className="max-w-[280px]" title={draft.error}>
			<Item
				variant="outline"
				className={`h-full flex-nowrap gap-[9px] rounded-[10px] bg-card py-1.5 pr-1.5 pl-[7px] text-[16px] ${failed ? "border-destructive" : ""}`}
			>
				<ItemMedia>
					{draft.preview ? (
						<img className="size-[34px] rounded-md object-cover" src={draft.preview} alt="" />
					) : (
						<span className="grid size-[34px] place-items-center rounded-md bg-muted text-[10px] font-semibold text-muted-foreground uppercase">
							{draft.file.name.split(".").at(-1)?.slice(0, 4) || "file"}
						</span>
					)}
				</ItemMedia>
				<ItemContent className="min-w-0 flex-initial gap-0">
					<ItemTitle className="line-clamp-none block w-full truncate text-[13px] leading-[1.3] font-normal">
						{draft.file.name}
					</ItemTitle>
					<ItemDescription
						className={`line-clamp-none text-[12px] leading-[1.3] wrap-anywhere ${failed ? "text-destructive" : ""}`}
					>
						{draft.state === "uploading"
							? "Reading…"
							: failed
								? draft.error
								: formatSize(draft.file.size)}
					</ItemDescription>
				</ItemContent>
				<ItemActions>
					<IconButton
						className="px-[7px] text-[16px]"
						onClick={onRemove}
						aria-label={`Remove ${draft.file.name}`}
					>
						×
					</IconButton>
				</ItemActions>
			</Item>
		</li>
	);
}
