import { SidebarTrigger } from "../components/sidebar.tsx";

/** On Windows and Linux the window controls cover the top right, and this keeps the bar clear of them. */
const CLEAR_WINDOW_CONTROLS =
	"pr-[calc(100vw-env(titlebar-area-x,0px)-env(titlebar-area-width,100vw))]";

/**
 * The strip across the top of the window. It moves the window, holds the macOS window controls
 * on the left, and keeps the sidebar toggle in one place whether the sidebar is open or not.
 */
export function WindowBar() {
	return (
		<div
			className={`flex h-(--window-bar-height) flex-none items-center bg-rail pl-3 app-drag mac-controls:pl-[90px] ${CLEAR_WINDOW_CONTROLS}`}
		>
			<SidebarTrigger />
		</div>
	);
}
