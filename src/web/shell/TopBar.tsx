import type { UsageSummary } from "../../shared/protocol.ts";

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

export function TopBar({ title, usage }: { title?: string; usage?: UsageSummary }) {
	return (
		<header className="flex h-[52px] flex-none items-center gap-2 px-6">
			{title && (
				<h1 className="min-w-0 truncate text-[14px] leading-[18px] font-medium">{title}</h1>
			)}
			<UsageLabel usage={usage} />
		</header>
	);
}
