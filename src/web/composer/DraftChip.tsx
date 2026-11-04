import type { Draft } from "./useDrafts.ts";

function formatSize(bytes: number): string {
	return bytes < 1024 * 1024
		? `${Math.max(1, Math.round(bytes / 1024))} KB`
		: `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DraftChip({ draft, onRemove }: { draft: Draft; onRemove: () => void }) {
	return (
		<li className={`chip chip-${draft.state}`} title={draft.error}>
			{draft.preview ? (
				<img src={draft.preview} alt="" />
			) : (
				<span className="chip-type">
					{draft.file.name.split(".").at(-1)?.slice(0, 4) || "file"}
				</span>
			)}
			<span className="chip-text">
				<span className="chip-name">{draft.file.name}</span>
				<span className="chip-meta">
					{draft.state === "uploading"
						? "Reading…"
						: draft.state === "failed"
							? draft.error
							: formatSize(draft.file.size)}
				</span>
			</span>
			<button
				type="button"
				className="chip-remove"
				onClick={onRemove}
				aria-label={`Remove ${draft.file.name}`}
			>
				×
			</button>
		</li>
	);
}
