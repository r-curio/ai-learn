import { IconButton } from "../components/IconButton.tsx";
import type { Draft } from "./useDrafts.ts";

function formatSize(bytes: number): string {
	return bytes < 1024 * 1024
		? `${Math.max(1, Math.round(bytes / 1024))} KB`
		: `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DraftChip({ draft, onRemove }: { draft: Draft; onRemove: () => void }) {
	const failed = draft.state === "failed";
	return (
		<li
			className={`flex max-w-[280px] items-center gap-[9px] rounded-[10px] border bg-surface py-1.5 pr-1.5 pl-[7px] ${failed ? "border-danger" : "border-line"}`}
			title={draft.error}
		>
			{draft.preview ? (
				<img className="size-[34px] flex-none rounded-md object-cover" src={draft.preview} alt="" />
			) : (
				<span className="grid size-[34px] flex-none place-items-center rounded-md bg-user-bg text-[10px] font-semibold text-muted uppercase">
					{draft.file.name.split(".").at(-1)?.slice(0, 4) || "file"}
				</span>
			)}
			<span className="flex min-w-0 flex-col leading-[1.3]">
				<span className="truncate text-[13px]">{draft.file.name}</span>
				<span className={`text-[12px] wrap-anywhere ${failed ? "text-danger" : "text-muted"}`}>
					{draft.state === "uploading"
						? "Reading…"
						: failed
							? draft.error
							: formatSize(draft.file.size)}
				</span>
			</span>
			<IconButton
				className="px-[7px] text-[16px]"
				onClick={onRemove}
				aria-label={`Remove ${draft.file.name}`}
			>
				×
			</IconButton>
		</li>
	);
}
