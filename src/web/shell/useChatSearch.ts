import { useEffect, useState } from "react";
import type { SearchResult, SessionSummary } from "../../shared/protocol.ts";
import { searchSessions } from "../api.ts";

const PAUSE_MS = 150;

/** What the sidebar's search field shows. Runs again when the chat list changes, like after a delete. */
export function useChatSearch(sessions: SessionSummary[]) {
	const [query, setQuery] = useState("");
	const [found, setFound] = useState<{ query: string; results: SearchResult[] }>();
	const [failed, setFailed] = useState(false);
	const searched = query.trim();

	useEffect(() => {
		if (!searched) return;
		const controller = new AbortController();
		const timer = setTimeout(() => {
			searchSessions(searched, controller.signal)
				.then((results) => {
					setFound({ query: searched, results });
					setFailed(false);
				})
				.catch(() => {
					if (!controller.signal.aborted) setFailed(true);
				});
		}, PAUSE_MS);
		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	}, [searched, sessions]);

	function change(next: string) {
		setQuery(next);
		if (!next.trim()) {
			setFound(undefined);
			setFailed(false);
		}
	}

	return { query, change, found: searched ? found : undefined, failed: searched ? failed : false };
}
