import { cn } from "cn";
import { CircleDot, House, MessageSquare, Share2, type LucideIcon } from "lucide-react";
import { Button } from "../components/button.tsx";

export type RailView = "chat" | "settings";

function RailItem({
	icon: Icon,
	label,
	active = false,
	onClick,
}: {
	icon: LucideIcon;
	label: string;
	active?: boolean;
	onClick?: () => void;
}) {
	return (
		<Button
			variant="ghost"
			size="icon"
			// Home and graphs have nowhere to go yet, so they're inert but keep their full colour.
			disabled={!onClick}
			onClick={active ? undefined : onClick}
			aria-label={label}
			aria-current={active ? "page" : undefined}
			className={cn(
				"size-9 flex-none p-0 disabled:opacity-100",
				active ? "bg-card text-primary hover:bg-card hover:text-primary" : "text-muted-foreground",
			)}
		>
			<Icon className="size-5" strokeWidth={1.5} />
		</Button>
	);
}

/** Always visible, below the window bar and beside the panel that holds the sidebar and chat. */
export function Rail({
	view,
	onViewChange,
}: {
	view: RailView;
	onViewChange: (view: RailView) => void;
}) {
	return (
		<nav
			aria-label="Sections"
			className="flex h-full w-(--rail-width) flex-none flex-col items-center gap-1.5 bg-rail pt-1 pb-4"
		>
			<RailItem icon={House} label="Home" />
			<RailItem
				icon={MessageSquare}
				label="Chats"
				active={view === "chat"}
				onClick={() => onViewChange("chat")}
			/>
			<RailItem icon={Share2} label="Graphs" />
			<div className="flex-1" />
			<RailItem
				icon={CircleDot}
				label="Settings"
				active={view === "settings"}
				onClick={() => onViewChange("settings")}
			/>
		</nav>
	);
}
