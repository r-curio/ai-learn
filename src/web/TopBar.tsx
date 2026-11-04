import type { EngineStatus, UsageSummary } from "../shared/protocol.ts";

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
		<header className="topbar">
			<button
				type="button"
				className="button-quiet sidebar-toggle"
				onClick={onToggleSidebar}
				aria-expanded={sidebarOpen}
			>
				Chats
			</button>
			<span className="meta">
				{status?.model}
				{usage ? ` · ${formatCost(usage)}` : ""}
			</span>
		</header>
	);
}
