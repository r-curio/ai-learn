import { cn } from "cn";
import { X } from "lucide-react";
import { useCallback, useState } from "react";
import type { UsageSummary } from "../../shared/protocol.ts";
import { IconButton } from "../components/IconButton.tsx";
import { UsageLabel } from "../shell/TopBar.tsx";
import { ImageView, TextView } from "./FileViews.tsx";
import { PdfView } from "./PdfView.tsx";
import type { PaneTarget } from "./useAttachmentPane.ts";

/** On Windows and Linux the window controls cover the top right, and this keeps Close clear of them. */
const CLEAR_WINDOW_CONTROLS =
	"pr-[calc(100vw-env(titlebar-area-x,0px)-env(titlebar-area-width,100vw)+10px)]";

function PaneContents({
	target,
	usage,
	onClose,
	onPageChange,
}: {
	target: PaneTarget;
	usage?: UsageSummary;
	onClose: () => void;
	onPageChange: (page: number) => void;
}) {
	const { sessionId, attachment, citation } = target;
	const [page, setPage] = useState<{ current: number; total: number }>();
	const showPage = useCallback(
		(next: { current: number; total: number }) => {
			setPage(next);
			onPageChange(next.current);
		},
		[onPageChange],
	);
	const file = { sessionId, attachmentId: attachment.id, name: attachment.name };
	return (
		<>
			<header
				className={`flex h-[52px] flex-none items-center gap-3 border-b border-border pl-4 app-drag ${CLEAR_WINDOW_CONTROLS}`}
			>
				<h2 className="min-w-0 truncate text-[14px] leading-[18px] font-medium">
					{attachment.name}
				</h2>
				{page && (
					<span className="flex-none text-[13px] leading-[18px] text-muted-foreground tabular-nums">
						Page {page.current} of {page.total}
					</span>
				)}
				<div className="grow" />
				<UsageLabel usage={usage} />
				<IconButton aria-label={`Close ${attachment.name}`} className="size-7" onClick={onClose}>
					<X className="size-4" strokeWidth={1.5} />
				</IconButton>
			</header>
			{attachment.kind === "pdf" && (
				<PdfView {...file} citation={citation} onPageChange={showPage} />
			)}
			{attachment.kind === "image" && <ImageView {...file} />}
			{attachment.kind === "text" && <TextView {...file} />}
		</>
	);
}

/** Beside the chat, or in place of it when the window has no room for both. */
export function AttachmentPane({
	target,
	open,
	usage,
	onClose,
	onPageChange,
}: {
	target?: PaneTarget;
	open: boolean;
	usage?: UsageSummary;
	onClose: () => void;
	onPageChange: (page: number) => void;
}) {
	return (
		<aside
			aria-label="Attachment"
			inert={!open}
			className={cn(
				"flex flex-none flex-col overflow-hidden bg-sidebar transition-[width]",
				open
					? "w-[calc(100%-470px)] border-l border-border motion-surface max-[1100px]:w-full max-[1100px]:border-l-0"
					: "w-0 duration-[120ms] ease-in motion-reduce:duration-0",
			)}
		>
			{target && (
				<PaneContents
					key={`${target.sessionId}/${target.attachment.id}`}
					target={target}
					usage={usage}
					onClose={onClose}
					onPageChange={onPageChange}
				/>
			)}
		</aside>
	);
}
