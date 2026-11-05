import { Pencil, X } from "lucide-react";
import type { SessionSummary } from "../../shared/protocol.ts";
import { Button } from "../components/button.tsx";
import {
	Sidebar,
	SidebarContent,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarTrigger,
	useSidebar,
} from "../components/sidebar.tsx";
import { Logo } from "./Logo.tsx";

function ChatRow({
	summary,
	active,
	disabled,
	onOpen,
	onDelete,
}: {
	summary: SessionSummary;
	active: boolean;
	disabled: boolean;
	onOpen: () => void;
	onDelete: () => void;
}) {
	return (
		<SidebarMenuItem>
			<SidebarMenuButton isActive={active} disabled={disabled} onClick={onOpen}>
				{summary.title}
			</SidebarMenuButton>
			<SidebarMenuAction
				disabled={disabled}
				onClick={onDelete}
				aria-label={`Delete ${summary.title}`}
			>
				<X className="size-4" strokeWidth={1.5} />
			</SidebarMenuAction>
		</SidebarMenuItem>
	);
}

interface ChatSidebarProps {
	sessions: SessionSummary[];
	activeId?: string;
	/** The new chat screen is open, so New chat shows as the current place. */
	onNewChatScreen: boolean;
	disabled: boolean;
	onNewChat: () => void;
	onOpen: (id: string) => void;
	onDelete: (summary: SessionSummary) => void;
}

export function ChatSidebar({
	sessions,
	activeId,
	onNewChatScreen,
	disabled,
	onNewChat,
	onOpen,
	onDelete,
}: ChatSidebarProps) {
	const { setOpenMobile } = useSidebar();
	return (
		<Sidebar aria-label="Chats">
			<SidebarHeader className="gap-3.5 px-2.5 pt-3.5">
				<div className="flex h-7 items-center justify-between pr-1 pl-2 app-drag">
					<div className="flex items-center gap-2">
						<Logo />
						<span className="text-[16px] leading-5 font-semibold tracking-[-0.02em]">ai-learn</span>
					</div>
					<SidebarTrigger />
				</div>
				<Button
					variant="ghost"
					data-current={onNewChatScreen || undefined}
					className="h-9 justify-start gap-2.5 rounded-md px-2.5 text-[14px] leading-[18px] font-medium data-current:bg-card data-current:hover:bg-card"
					disabled={disabled}
					onClick={() => {
						setOpenMobile(false);
						onNewChat();
					}}
				>
					<Pencil className="size-[18px]" strokeWidth={1.5} />
					New chat
				</Button>
			</SidebarHeader>
			<SidebarContent className="px-2.5 pt-3.5 pb-4">
				<SidebarMenu>
					{sessions.map((summary) => (
						<ChatRow
							key={summary.id}
							summary={summary}
							active={summary.id === activeId}
							disabled={disabled}
							onOpen={() => {
								setOpenMobile(false);
								onOpen(summary.id);
							}}
							onDelete={() => onDelete(summary)}
						/>
					))}
				</SidebarMenu>
				{sessions.length === 0 && (
					<p className="px-2.5 text-[14px] leading-[18px] text-muted-foreground">
						Your chats will appear here.
					</p>
				)}
			</SidebarContent>
		</Sidebar>
	);
}
