import type { EngineStatus, UsageSummary } from "../shared/protocol.ts";
import { Button } from "./components/button.tsx";

function formatCost(usage: UsageSummary): string {
	const total = (usage.inputTokens + usage.outputTokens).toLocaleString();
	return `${total} tokens · $${usage.costUsd.toFixed(usage.costUsd < 1 ? 4 : 2)}`;
}

interface TopBarProps {
	status?: EngineStatus;
	usage?: UsageSummary;
	sidebarOpen: boolean;
	onToggleSidebar: () => void;
}

export function TopBar({ status, usage, sidebarOpen, onToggleSidebar }: TopBarProps) {
	return (
		<header className="flex min-h-[45px] items-center justify-end gap-4 border-b border-border px-5 py-[9px] text-[13px] max-md:justify-between max-md:px-4">
			<Button
				variant="outline"
				size="xs"
				className="hidden max-md:block"
				onClick={onToggleSidebar}
				aria-expanded={sidebarOpen}
			>
				Chats
			</Button>
			<span className="text-right text-muted-foreground tabular-nums">
				{status?.model}
				{usage ? ` · ${formatCost(usage)}` : ""}
			</span>
		</header>
	);
}
