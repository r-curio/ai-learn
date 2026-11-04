import type { SessionSummary } from "../shared/protocol.ts";
import "./sidebar.css";

interface SidebarProps {
	sessions: SessionSummary[];
	activeId?: string;
	disabled: boolean;
	onNewChat: () => void;
	onOpen: (id: string) => void;
	onDelete: (summary: SessionSummary) => void;
}

export function Sidebar({
	sessions,
	activeId,
	disabled,
	onNewChat,
	onOpen,
	onDelete,
}: SidebarProps) {
	return (
		<aside className="sidebar" aria-label="Chats">
			<div className="sidebar-head">
				<span className="brand">ai-learn</span>
				<button type="button" className="button-quiet" disabled={disabled} onClick={onNewChat}>
					New chat
				</button>
			</div>
			<ul className="session-list">
				{sessions.map((summary) => (
					<li
						key={summary.id}
						className={summary.id === activeId ? "session session-active" : "session"}
					>
						<button
							type="button"
							className="session-open"
							disabled={disabled}
							onClick={() => onOpen(summary.id)}
							aria-current={summary.id === activeId ? "true" : undefined}
						>
							{summary.title}
						</button>
						<button
							type="button"
							className="session-delete"
							disabled={disabled}
							onClick={() => onDelete(summary)}
							aria-label={`Delete ${summary.title}`}
						>
							×
						</button>
					</li>
				))}
			</ul>
			{sessions.length === 0 && <p className="sidebar-empty">Your chats will appear here.</p>}
		</aside>
	);
}
