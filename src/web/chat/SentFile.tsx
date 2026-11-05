import { Braces, File, FileSpreadsheet, FileText } from "lucide-react";
import type { AttachmentInfo } from "../../shared/protocol.ts";
import { Badge } from "../components/badge.tsx";

const isCsvName = (name: string) => /\.csv$/i.test(name);

/** PDFs and CSVs get a card with their type. Other files are a small pill. */
export const isDocument = ({ kind, name }: AttachmentInfo) => kind === "pdf" || isCsvName(name);

export function SentDocument({ attachment }: { attachment: AttachmentInfo }) {
	const csv = isCsvName(attachment.name);
	const Icon = csv ? FileSpreadsheet : FileText;
	return (
		<div
			className="flex w-[200px] items-center gap-2.5 rounded-2xl border border-border bg-card p-1.5"
			title={attachment.name}
		>
			<span className="grid size-10 flex-none place-items-center rounded-lg bg-background text-muted-foreground">
				<Icon className="size-5" strokeWidth={1.5} />
			</span>
			<span className="min-w-0">
				<span className="block truncate text-[14px] leading-[18px]">{attachment.name}</span>
				<span className="block text-[12px] leading-4 text-muted-foreground">
					{csv ? "CSV" : "PDF"}
				</span>
			</span>
		</div>
	);
}

export function SentFile({ name }: { name: string }) {
	const Icon = /\.json$/i.test(name) ? Braces : File;
	return (
		<Badge
			variant="outline"
			className="h-8 max-w-[280px] gap-1.5 rounded-full bg-card px-3 text-[13px] font-normal"
			title={name}
		>
			<Icon className="size-4 flex-none text-muted-foreground" strokeWidth={1.5} />
			<span className="truncate">{name}</span>
		</Badge>
	);
}
