import {
	fauxAssistantMessage,
	fauxToolCall,
	getCurrentTools,
	type FauxResponseFactory,
	type FauxResponseStep,
} from "@earendil-works/pi-ai";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { Engine } from "../../src/harness/engine.ts";
import { createScriptedEngine } from "../../src/harness/fake-engine.ts";
import { Session } from "../../src/harness/sessions/session.ts";
import type { SearchService } from "../../src/harness/web/search-service.ts";
import {
	SEARCH_LIMIT,
	SEARCH_LIMIT_LABEL,
	SEARCH_LIMIT_NOTICE,
} from "../../src/harness/web/web-tools.ts";
import type { RunEvent } from "../../src/shared/protocol.ts";
import { FAKE_CHOICE, tempDir } from "../helpers.ts";

const realFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = realFetch;
});

const noEvents = () => undefined;
const send = (session: Session, text: string, onEvent: (event: RunEvent) => void = noEvents) =>
	session.send({ text, attachmentIds: [] }, onEvent, FAKE_CHOICE);

/** A search service that counts its calls, and fails the test if `fail` is set. */
function fakeSearch(fail = false) {
	const service: SearchService & { calls: number } = {
		label: "Test search",
		calls: 0,
		async search(query) {
			service.calls += 1;
			if (fail) throw new Error("A replay must not search again.");
			return [{ title: "Moon facts", url: "https://example.org/moon", snippet: `About ${query}.` }];
		},
	};
	return service;
}

const withSearch = (steps: FauxResponseStep[], search?: SearchService) => {
	const engine = createScriptedEngine(steps);
	return { ...engine, searchService: async () => search } satisfies Engine;
};

const searchCall = (query: string) =>
	fauxAssistantMessage(fauxToolCall("web_search", { query }), { stopReason: "toolUse" });

test("an old chat with search results replays without a network call", async () => {
	const dataDir = await tempDir();
	const first = withSearch(
		[searchCall("moon distance"), fauxAssistantMessage("About 384,400 km.")],
		fakeSearch(),
	);
	const session = new Session(first, dataDir);
	await send(session, "How far is the Moon?");
	const saved = session
		.view()
		.messages.at(-1)
		?.blocks.find((block) => block.kind === "tool");
	assert.equal(saved?.kind === "tool" && saved.label, "Searched “moon distance”");

	let fetches = 0;
	globalThis.fetch = async () => {
		fetches += 1;
		throw new Error("No network during a replay.");
	};
	let replayed = "";
	const capture: FauxResponseFactory = (context) => {
		const result = context.messages.find((message) => message.role === "toolResult");
		replayed =
			result?.role === "toolResult" && result.content[0]?.type === "text"
				? result.content[0].text
				: "";
		return fauxAssistantMessage("Glad that helped.");
	};
	const search = fakeSearch(true);
	const reloaded = await Session.load(withSearch([capture], search), dataDir, session.id);
	await send(reloaded, "Thanks");

	assert.equal(fetches, 0);
	assert.equal(search.calls, 0);
	assert.match(
		replayed,
		/^<search_results query="moon distance">\n1\. Moon facts\nhttps:\/\/example\.org\/moon/,
	);
	assert.match(replayed, /<\/search_results>$/);
});

test("the runaway guard stops a run that keeps searching, and says why", async () => {
	const dataDir = await tempDir();
	const search = fakeSearch();
	const loop = Array.from({ length: SEARCH_LIMIT + 10 }, (_, index) =>
		searchCall(`query ${index}`),
	);
	const engine = withSearch(loop, search);
	const session = new Session(engine, dataDir);
	const events: RunEvent[] = [];
	await send(session, "Keep checking", (event) => events.push(event));

	assert.equal(search.calls, SEARCH_LIMIT);
	assert.equal(engine.faux.state.callCount, SEARCH_LIMIT + 1);
	const labelled = events.filter(
		(event) => event.type === "tool_end" && event.label === SEARCH_LIMIT_LABEL,
	);
	assert.equal(labelled.length, 1);

	const view = session.view();
	const reply = view.messages.at(-1);
	const tools = reply?.blocks.filter((block) => block.kind === "tool") ?? [];
	assert.equal(tools.length, SEARCH_LIMIT + 1);
	assert.deepEqual(tools.at(-1), { ...tools.at(-1), label: SEARCH_LIMIT_LABEL, state: "failed" });
	assert.equal(reply?.notice, SEARCH_LIMIT_NOTICE);
	assert.equal(view.canRetry, true);
});

test("web_search is offered only with a search key, and read_page always", async () => {
	const offered: string[][] = [];
	/** What each model request offers, seen where it leaves the harness. Pi declares tools in the messages. */
	const recording = (search?: SearchService): Engine => {
		const engine = withSearch([fauxAssistantMessage("Done.")], search);
		return {
			...engine,
			streamFn: (model, context, options) => {
				offered.push(getCurrentTools(context.messages).map((tool) => tool.name));
				return engine.streamFn(model, context, options);
			},
		};
	};
	const dataDir = await tempDir();
	await send(new Session(recording(), dataDir), "Hi");
	await send(new Session(recording(fakeSearch()), dataDir), "Hi");
	assert.ok(!offered[0]?.includes("web_search"));
	assert.ok(offered[0]?.includes("read_page"));
	assert.ok(offered[1]?.includes("web_search"));
});
