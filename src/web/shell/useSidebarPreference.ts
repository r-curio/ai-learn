import { useCallback, useEffect, useState } from "react";
import { getPreferences, savePreferences } from "../api.ts";

/**
 * Whether the sidebar is open, saved through the local server. Browser storage wouldn't last,
 * because the desktop app gets a new port on each launch. Undefined until the saved value loads.
 */
export function useSidebarPreference() {
	const [open, setOpenState] = useState<boolean>();

	useEffect(() => {
		getPreferences()
			.then((preferences) => setOpenState(preferences.sidebarOpen))
			.catch(() => setOpenState(true));
	}, []);

	const setOpen = useCallback((next: boolean) => {
		setOpenState(next);
		savePreferences({ sidebarOpen: next }).catch((cause: Error) => {
			console.warn(`Couldn't save the sidebar setting: ${cause.message}`);
		});
	}, []);

	return { open, setOpen };
}
