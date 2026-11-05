import type { SessionSummary } from "../shared/protocol.ts";
import { Button } from "./components/button.tsx";
import { IconButton } from "./components/IconButton.tsx";

interface SidebarProps {
	/** On narrow windows the sidebar is an overlay, shown only while open. */
	open: boolean;
	sessions: SessionSummary[];
	activeId?: string;
	disabled: boolean;
	onNewChat: () => void;
	onOpen: (id: string) => void;
	onDelete: (summary: SessionSummary) => void;
}

export function Sidebar({
	open,
	sessions,
	activeId,
	disabled,
	onNewChat,
	onOpen,
	onDelete,
}: SidebarProps) {
	return (
		<aside
			className={`flex w-[250px] flex-none flex-col overflow-y-auto border-r border-border max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:z-2 max-md:w-[min(280px,85vw)] max-md:bg-background max-md:shadow-[0_0_0_100vw_rgb(0_0_0/0.3)] ${open ? "" : "max-md:hidden"}`}
			aria-label="Chats"
		>
			<div className="flex items-center justify-between border-b border-border py-[9px] pr-2.5 pl-4 text-[13px]">
				<span className="font-semibold">ai-learn</span>
				<Button variant="outline" size="sm" disabled={disabled} onClick={onNewChat}>
					New chat
				</Button>
			</div>
			<ul className="p-2">
				{sessions.map((summary) => (
					<li
						key={summary.id}
						data-active={summary.id === activeId || undefined}
						className="group flex items-center rounded-[7px] hover:bg-accent data-active:bg-accent"
					>
						<Button
							variant="ghost"
							className="block min-w-0 flex-1 truncate px-2 py-1.5 text-left text-[13.5px] hover:bg-transparent"
							disabled={disabled}
							onClick={() => onOpen(summary.id)}
							aria-current={summary.id === activeId ? "true" : undefined}
						>
							{summary.title}
						</Button>
						<IconButton
							className="px-2 text-[15px] opacity-0 group-hover:opacity-100 group-data-active:opacity-100 focus-visible:opacity-100 disabled:opacity-45 max-md:enabled:opacity-100"
							disabled={disabled}
							onClick={() => onDelete(summary)}
							aria-label={`Delete ${summary.title}`}
						>
							×
						</IconButton>
					</li>
				))}
			</ul>
			{sessions.length === 0 && (
				<p className="px-4 py-1 text-[13px] text-muted-foreground">Your chats will appear here.</p>
			)}
		</aside>
	);
}
