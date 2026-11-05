import { cn } from "cn";
import { CircleDot, House, MessageSquare, Share2, type LucideIcon } from "lucide-react";
import { Button } from "../components/button.tsx";

function RailItem({
	icon: Icon,
	label,
	active = false,
}: {
	icon: LucideIcon;
	label: string;
	active?: boolean;
}) {
	return (
		<Button
			variant="ghost"
			size="icon"
			// Only chat has somewhere to go so far. The rest are inert, but keep their full colour.
			disabled={!active}
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

/** Always visible, and sits above the sidebar so the sidebar can slide away beneath it. */
export function Rail() {
	return (
		<nav
			aria-label="Sections"
			className="relative z-20 flex h-full w-(--rail-width) flex-none flex-col items-center gap-1.5 bg-rail pb-4"
		>
			{/* The window's controls sit here on macOS. */}
			<div className="h-11 w-full flex-none app-drag" />
			<RailItem icon={House} label="Home" />
			<RailItem icon={MessageSquare} label="Chats" active />
			<RailItem icon={Share2} label="Graphs" />
			<div className="flex-1" />
			<RailItem icon={CircleDot} label="Settings" />
		</nav>
	);
}
