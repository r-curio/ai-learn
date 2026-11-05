import { cn } from "cn";
import { File as FileIcon, FileSpreadsheet, FileText, Loader2, X } from "lucide-react";
import { IconButton } from "../components/IconButton.tsx";
import { isCsv } from "./csvPreview.ts";
import type { Draft } from "./useDrafts.ts";

function TypeIcon({ file, className }: { file: File; className: string }) {
	const Icon = isCsv(file)
		? FileSpreadsheet
		: file.type === "application/pdf"
			? FileText
			: FileIcon;
	return <Icon className={className} strokeWidth={1.5} />;
}

function CsvTable({ rows }: { rows: string[][] }) {
	return (
		<div className="min-h-0 flex-1 overflow-hidden bg-card" aria-hidden="true">
			<table className="w-full table-fixed border-collapse text-[12px] leading-4">
				<tbody>
					{rows.map((row, rowIndex) => (
						<tr
							key={rowIndex}
							className={cn("border-b border-border", rowIndex === 0 && "font-medium")}
						>
							{row.map((cell, cellIndex) => (
								<td key={cellIndex} className="truncate px-1.5 py-0.5">
									{cell}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function DraftBody({ draft }: { draft: Draft }) {
	if (draft.state === "failed")
		return (
			<p className="min-h-0 flex-1 overflow-hidden p-2.5 pr-8 text-[13px] leading-4 wrap-anywhere text-destructive">
				{draft.error}
			</p>
		);
	if (draft.table?.length) return <CsvTable rows={draft.table} />;
	if (draft.preview)
		return (
			<img
				className="min-h-0 w-full flex-1 bg-card object-cover object-top"
				src={draft.preview}
				alt=""
			/>
		);
	return (
		<span className="grid min-h-0 flex-1 place-items-center bg-background text-muted-foreground">
			{draft.state !== "uploading" && <TypeIcon file={draft.file} className="size-6" />}
		</span>
	);
}

export function DraftChip({ draft, onRemove }: { draft: Draft; onRemove: () => void }) {
	const failed = draft.state === "failed";
	const imageOnly = draft.file.type.startsWith("image/") && !failed && Boolean(draft.preview);
	return (
		<li
			className={cn(
				"group relative flex h-[122px] shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-muted",
				imageOnly ? "w-[122px]" : "w-40",
				failed && "border-destructive",
			)}
			title={draft.error ?? draft.file.name}
		>
			<DraftBody draft={draft} />
			{imageOnly ? (
				<span className="sr-only">{draft.file.name}</span>
			) : (
				<div className="flex h-8 flex-none items-center gap-1.5 px-2 text-[13px]">
					<TypeIcon file={draft.file} className="size-4 flex-none text-muted-foreground" />
					<span className="truncate">{draft.file.name}</span>
				</div>
			)}
			{draft.state === "uploading" && (
				<div
					className="absolute inset-0 grid place-items-center bg-background/60"
					role="status"
					aria-label={`Reading ${draft.file.name}`}
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
				aria-label={`Remove ${draft.file.name}`}
			>
				<X className="size-3.5" strokeWidth={1.5} />
			</IconButton>
		</li>
	);
}
