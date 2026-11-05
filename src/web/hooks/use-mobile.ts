import { useSyncExternalStore } from "react";

/** Matches `--breakpoint-md` in globals.css. */
const NARROW = "(max-width: 720px)";

function subscribe(onChange: () => void) {
	const query = window.matchMedia(NARROW);
	query.addEventListener("change", onChange);
	return () => query.removeEventListener("change", onChange);
}

export function useIsMobile() {
	return useSyncExternalStore(subscribe, () => window.matchMedia(NARROW).matches);
}
