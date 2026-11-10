import type { UsageSummary } from "../../shared/protocol.ts";
import { ChatTitle } from "./ChatTitle.tsx";

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

export function TopBar({
	title,
	usage,
	onRename,
}: {
	title?: string;
	usage?: UsageSummary;
	/** Missing while the chat can't be renamed, like during a reply. */
	onRename?: (title: string) => Promise<void>;
}) {
	return (
		<header className="flex h-[52px] flex-none items-center gap-2 px-6">
			{title && <ChatTitle title={title} onRename={onRename} />}
			<UsageLabel usage={usage} />
		</header>
	);
}
