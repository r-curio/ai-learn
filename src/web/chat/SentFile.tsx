import { Braces, File, FileSpreadsheet, FileText } from "lucide-react";
import type { AttachmentInfo } from "../../shared/protocol.ts";
import { Button } from "../components/button.tsx";

const isCsvName = (name: string) => /\.csv$/i.test(name);

/** PDFs and CSVs get a card with their type. Other files are a small pill. */
export const isDocument = ({ kind, name }: AttachmentInfo) => kind === "pdf" || isCsvName(name);

/** A card, which shrinks to a pill while the attachment pane leaves the chat less room. */
export function SentDocument({
	attachment,
	onOpen,
}: {
	attachment: AttachmentInfo;
	onOpen: () => void;
}) {
	const csv = isCsvName(attachment.name);
	const Icon = csv ? FileSpreadsheet : FileText;
	return (
		<Button
			variant="outline"
			className="h-auto w-[200px] justify-start gap-2.5 rounded-2xl bg-card p-1.5 text-left font-normal text-foreground in-data-compact:h-[30px] in-data-compact:w-auto in-data-compact:max-w-full in-data-compact:gap-1.5 in-data-compact:rounded-[15px] in-data-compact:py-0 in-data-compact:pr-3 in-data-compact:pl-2.5"
			title={attachment.name}
			onClick={onOpen}
		>
			<span className="grid size-10 flex-none place-items-center rounded-lg bg-background text-muted-foreground in-data-compact:size-3.5 in-data-compact:bg-transparent">
				<Icon className="size-5 in-data-compact:size-3.5" strokeWidth={1.5} />
			</span>
			<span className="min-w-0 in-data-compact:flex in-data-compact:items-center in-data-compact:gap-1.5">
				<span className="block truncate text-[14px] leading-[18px] in-data-compact:text-[13px] in-data-compact:leading-4">
					{attachment.name}
				</span>
				<span className="block text-[12px] leading-4 text-muted-foreground">
					{csv ? "CSV" : "PDF"}
				</span>
			</span>
		</Button>
	);
}

export function SentFile({ name, onOpen }: { name: string; onOpen: () => void }) {
	const Icon = /\.json$/i.test(name) ? Braces : File;
	return (
		<Button
			variant="outline"
			className="h-8 max-w-[280px] justify-start gap-1.5 rounded-full bg-card px-3 text-[13px] font-normal text-foreground"
			title={name}
			onClick={onOpen}
		>
			<Icon className="size-4 flex-none text-muted-foreground" strokeWidth={1.5} />
			<span className="truncate">{name}</span>
		</Button>
	);
}
