export interface SearchHit {
	title: string;
	url: string;
	snippet: string;
}

/** Something that searches the web. Tavily is the only one for now, and another can be added beside it. */
export interface SearchService {
	label: string;
	search(query: string, signal?: AbortSignal): Promise<SearchHit[]>;
}

/** A web tool that couldn't do its job, with a reason that's safe to give the tutor. It never holds a key. */
export class WebToolError extends Error {}
