import type { UsageSummary } from "../../shared/protocol.ts";
import { SidebarTrigger, useSidebar } from "../components/sidebar.tsx";

function formatCost(usage: UsageSummary): string {
	const total = (usage.inputTokens + usage.outputTokens).toLocaleString();
	return `${total} tokens · $${usage.costUsd.toFixed(usage.costUsd < 1 ? 4 : 2)}`;
}

export function UsageLabel({ usage }: { usage?: UsageSummary }) {
	if (!usage || usage.inputTokens + usage.outputTokens === 0) return null;
	return (
		<span className="ml-auto flex-none text-[12px] leading-4 text-muted-foreground tabular-nums">
			{formatCost(usage)}
		</span>
	);
}

/** On Windows and Linux the window controls cover the top right, and this keeps usage clear of them. */
const CLEAR_WINDOW_CONTROLS =
	"pr-[calc(100vw-env(titlebar-area-x,0px)-env(titlebar-area-width,100vw)+24px)]";

export function TopBar({ title, usage }: { title?: string; usage?: UsageSummary }) {
	const { open, isMobile } = useSidebar();
	const showTrigger = !open || isMobile;
	return (
		<header
			className={`flex h-[52px] flex-none items-center gap-2 pl-4 app-drag in-data-compact:pl-6 ${CLEAR_WINDOW_CONTROLS}`}
		>
			{showTrigger && <SidebarTrigger className="animate-in duration-300 fade-in" />}
			{title && (
				<h1 className="min-w-0 truncate text-[14px] leading-[18px] font-medium">{title}</h1>
			)}
			<UsageLabel usage={usage} />
		</header>
	);
}
