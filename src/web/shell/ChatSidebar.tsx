import { Pencil, X } from "lucide-react";
import { useState } from "react";
import type { ChatType, SearchResult, SessionSummary, SnippetPart } from "../../shared/protocol.ts";
import { Button } from "../components/button.tsx";
import { SegmentedTabs } from "../components/tabs.tsx";
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
import { ChatSearchField, ChatSnippet, SearchStatus } from "./ChatSearch.tsx";
import { Logo } from "./Logo.tsx";
import { useChatSearch } from "./useChatSearch.ts";

type ChatFilter = "all" | ChatType;

const FILTER_OPTIONS: readonly { value: ChatFilter; label: string }[] = [
	{ value: "all", label: "All" },
	{ value: "learning", label: "Learning" },
	{ value: "practice", label: "Practice" },
];

function ChatRow({
	summary,
	snippet,
	active,
	disabled,
	onOpen,
	onDelete,
}: {
	summary: SessionSummary;
	/** Set when this row is a search result. */
	snippet?: SnippetPart[];
	active: boolean;
	disabled: boolean;
	onOpen: () => void;
	onDelete: () => void;
}) {
	return (
		<SidebarMenuItem>
			<SidebarMenuButton
				isActive={active}
				disabled={disabled}
				className={snippet && "flex h-14 flex-col justify-center gap-0.5"}
				onClick={onOpen}
			>
				{snippet ? (
					<>
						<span className="block w-full truncate font-medium text-foreground">
							{summary.title}
						</span>
						{snippet.length > 0 && <ChatSnippet parts={snippet} />}
					</>
				) : (
					summary.title
				)}
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

function SidebarTitleBar() {
	return (
		<div className="flex h-7 items-center justify-between pr-1 pl-2 app-drag">
			<div className="flex items-center gap-2">
				<Logo />
				<span className="text-[16px] leading-5 font-semibold tracking-[-0.02em]">ai-learn</span>
			</div>
			<SidebarTrigger />
		</div>
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
	const search = useChatSearch(sessions);
	const [filter, setFilter] = useState<ChatFilter>("all");
	const matches = (row: SessionSummary) => filter === "all" || row.chatType === filter;
	const found = search.found && { ...search.found, results: search.found.results.filter(matches) };
	const rows: (SessionSummary & Partial<SearchResult>)[] =
		found?.results ?? sessions.filter(matches);
	const typeLabel =
		filter === "all" ? undefined : FILTER_OPTIONS.find((option) => option.value === filter)?.label;
	return (
		<Sidebar aria-label="Chats">
			<SidebarHeader className="gap-3.5 px-2.5 pt-3.5">
				<SidebarTitleBar />
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
				<div className="flex flex-col gap-3">
					<ChatSearchField value={search.query} onChange={search.change} />
					{sessions.length > 0 && (
						<SegmentedTabs
							label="Filter chats by type"
							value={filter}
							options={FILTER_OPTIONS}
							onChange={setFilter}
						/>
					)}
				</div>
			</SidebarHeader>
			<SidebarContent className="px-2.5 pt-3 pb-4">
				<SearchStatus failed={search.failed} found={found} typeLabel={typeLabel} />
				<SidebarMenu>
					{rows.map((summary) => (
						<ChatRow
							key={summary.id}
							summary={summary}
							snippet={summary.snippet}
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
				{sessions.length === 0 && !search.found && !search.failed && (
					<p className="px-2.5 text-[14px] leading-[18px] text-muted-foreground">
						Your chats will appear here.
					</p>
				)}
				{sessions.length > 0 && rows.length === 0 && !found && !search.failed && (
					<p className="px-2.5 text-[14px] leading-[18px] text-muted-foreground">
						No {typeLabel} chats yet.
					</p>
				)}
			</SidebarContent>
		</Sidebar>
	);
}
