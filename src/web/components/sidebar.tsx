import { cn } from "cn";
import { PanelLeftIcon } from "lucide-react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ComponentProps,
	type CSSProperties,
} from "react";
import { useIsMobile } from "../hooks/use-mobile.ts";
import { Button } from "./button.tsx";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./sheet.tsx";

/*
 * shadcn's sidebar, cut down to the parts this app uses (ADR 0008). It always sits on the left,
 * beside the rail, and slides under the rail to collapse. The caller saves the open state.
 */
const SIDEBAR_WIDTH = "272px";
const RAIL_WIDTH = "56px";
const KEYBOARD_SHORTCUT = "b";

interface SidebarContextValue {
	state: "expanded" | "collapsed";
	open: boolean;
	setOpen: (open: boolean) => void;
	openMobile: boolean;
	setOpenMobile: (open: boolean) => void;
	isMobile: boolean;
	toggleSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

function useSidebar() {
	const context = useContext(SidebarContext);
	if (!context) throw new Error("useSidebar must be used within a SidebarProvider.");
	return context;
}

function SidebarProvider({
	open,
	onOpenChange,
	className,
	style,
	children,
	...props
}: ComponentProps<"div"> & { open: boolean; onOpenChange: (open: boolean) => void }) {
	const isMobile = useIsMobile();
	const [openMobile, setOpenMobile] = useState(false);

	const toggleSidebar = useCallback(() => {
		if (isMobile) setOpenMobile((current) => !current);
		else onOpenChange(!open);
	}, [isMobile, onOpenChange, open]);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
				event.preventDefault();
				toggleSidebar();
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [toggleSidebar]);

	const value = useMemo<SidebarContextValue>(
		() => ({
			state: open ? "expanded" : "collapsed",
			open,
			setOpen: onOpenChange,
			openMobile,
			setOpenMobile,
			isMobile,
			toggleSidebar,
		}),
		[open, onOpenChange, openMobile, isMobile, toggleSidebar],
	);

	return (
		<SidebarContext.Provider value={value}>
			<div
				data-slot="sidebar-wrapper"
				style={
					{
						"--sidebar-width": SIDEBAR_WIDTH,
						"--rail-width": RAIL_WIDTH,
						...style,
					} as CSSProperties
				}
				className={cn("flex h-full w-full", className)}
				{...props}
			>
				{children}
			</div>
		</SidebarContext.Provider>
	);
}

function Sidebar({ className, children, ...props }: ComponentProps<"div">) {
	const { isMobile, state, openMobile, setOpenMobile } = useSidebar();

	if (isMobile) {
		return (
			<Sheet open={openMobile} onOpenChange={setOpenMobile}>
				<SheetContent
					data-slot="sidebar"
					className="border-sidebar-border bg-sidebar p-0 text-sidebar-foreground data-[side=left]:left-(--rail-width) data-[side=left]:w-(--sidebar-width) [&>button]:hidden"
					style={{ "--sidebar-width": SIDEBAR_WIDTH, "--rail-width": RAIL_WIDTH } as CSSProperties}
					side="left"
				>
					<SheetHeader className="sr-only">
						<SheetTitle>Chats</SheetTitle>
						<SheetDescription>Start a new chat or open a saved one.</SheetDescription>
					</SheetHeader>
					<div className="flex h-full w-full flex-col">{children}</div>
				</SheetContent>
			</Sheet>
		);
	}

	const collapsed = state === "collapsed";
	return (
		<div className="group text-sidebar-foreground" data-state={state} data-slot="sidebar">
			<div
				data-slot="sidebar-gap"
				className={cn(
					"relative h-full transition-[width] motion-surface",
					collapsed ? "w-0" : "w-(--sidebar-width)",
				)}
			/>
			<div
				data-slot="sidebar-container"
				// Off-screen controls must not stay reachable by keyboard.
				inert={collapsed}
				className={cn(
					"fixed inset-y-0 z-10 flex w-(--sidebar-width) transition-[left] motion-surface",
					collapsed ? "left-[calc(var(--rail-width)-var(--sidebar-width))]" : "left-(--rail-width)",
					className,
				)}
				{...props}
			>
				<div data-slot="sidebar-inner" className="flex size-full flex-col bg-sidebar">
					{children}
				</div>
			</div>
		</div>
	);
}

function SidebarTrigger({ className, onClick, ...props }: ComponentProps<typeof Button>) {
	const { toggleSidebar, isMobile, open, openMobile } = useSidebar();
	const expanded = isMobile ? openMobile : open;
	return (
		<Button
			data-slot="sidebar-trigger"
			variant="ghost"
			size="icon-sm"
			className={cn(
				"text-muted-foreground aria-expanded:bg-transparent aria-expanded:text-muted-foreground aria-expanded:hover:bg-muted aria-expanded:hover:text-foreground",
				className,
			)}
			aria-label={expanded ? "Collapse sidebar" : "Open sidebar"}
			aria-expanded={expanded}
			onClick={(event) => {
				onClick?.(event);
				toggleSidebar();
			}}
			{...props}
		>
			<PanelLeftIcon className="size-[18px]" strokeWidth={1.5} />
		</Button>
	);
}

function SidebarInset({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-inset"
			className={cn("flex min-w-0 flex-1 flex-col bg-background", className)}
			{...props}
		/>
	);
}

function SidebarHeader({ className, ...props }: ComponentProps<"div">) {
	return <div data-slot="sidebar-header" className={cn("flex flex-col", className)} {...props} />;
}

function SidebarContent({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-content"
			className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto", className)}
			{...props}
		/>
	);
}

function SidebarMenu({ className, ...props }: ComponentProps<"ul">) {
	return (
		<ul data-slot="sidebar-menu" className={cn("flex flex-col gap-0.5", className)} {...props} />
	);
}

function SidebarMenuItem({ className, ...props }: ComponentProps<"li">) {
	return (
		<li
			data-slot="sidebar-menu-item"
			className={cn("group/menu-item relative", className)}
			{...props}
		/>
	);
}

function SidebarMenuButton({
	isActive = false,
	className,
	...props
}: ComponentProps<"button"> & { isActive?: boolean }) {
	return (
		<button
			type="button"
			data-slot="sidebar-menu-button"
			data-active={isActive || undefined}
			aria-current={isActive ? "true" : undefined}
			className={cn(
				"block h-9 w-full truncate rounded-md px-2.5 text-left text-[14px] leading-[18px] text-muted-foreground motion-press group-focus-within/menu-item:pr-8 group-hover/menu-item:pr-8 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring disabled:pointer-events-none disabled:opacity-45 data-active:bg-sidebar-accent data-active:font-medium data-active:text-sidebar-accent-foreground",
				className,
			)}
			{...props}
		/>
	);
}

function SidebarMenuAction({ className, ...props }: ComponentProps<typeof Button>) {
	return (
		<Button
			data-slot="sidebar-menu-action"
			variant="ghost"
			size="icon-sm"
			className={cn(
				"absolute top-1 right-1 text-muted-foreground opacity-0 group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 focus-visible:opacity-100 disabled:opacity-0",
				className,
			)}
			{...props}
		/>
	);
}

export {
	Sidebar,
	SidebarContent,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarTrigger,
	useSidebar,
};
