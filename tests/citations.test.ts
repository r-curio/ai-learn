import { fauxAssistantMessage } from "@earendil-works/pi-ai";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { createScriptedEngine } from "../src/harness/fake-engine.ts";
import { Session } from "../src/harness/sessions/session.ts";
import { parseCitations, stripCitations, textContainsQuote } from "../src/shared/citations.ts";
import { quoteRects } from "../src/web/viewer/pageHighlight.ts";
import { FAKE_CHOICE, makePdf, tempDir } from "./helpers.ts";

const QUOTE = "Relevance is measured by comparing keys";
const cite = (id: string, page: number, quote: string) =>
	`<cite attachment="${id}" page="${page}">${quote}</cite>`;

test("citations become page links, and a half-written tag never shows", () => {
	const { text, citations } = parseCitations(`A. ${cite("a1", 4, "exact words")} B.`);
	assert.equal(text, "A. [p. 4](#cite-0) B.");
	assert.deepEqual(citations, [{ attachmentId: "a1", page: 4, quote: "exact words" }]);
	assert.equal(
		parseCitations('Stopped. <cite attachment="a1" page="4">exact wor').text,
		"Stopped. ",
	);
	assert.equal(parseCitations("Streaming. <ci", true).text, "Streaming. ");
	assert.equal(
		parseCitations("An ordinary <cite>book</cite>.").text,
		"An ordinary <cite>book</cite>.",
	);
});

test("quotes match across line breaks, hyphenation, and typographic marks", () => {
	const page = "the raw mod-\nel’s scores  are\nnormalised";
	assert.ok(textContainsQuote(page, "The raw model's scores are normalised"));
	assert.ok(!textContainsQuote(page, "scores are averaged"));
	assert.ok(!textContainsQuote(page, "   "));
});

test("a replayed reply keeps its tag in the log, and only real quotes reach the learner", async () => {
	const dir = await tempDir();
	const engine = createScriptedEngine([]);
	const session = new Session(engine, dir);
	const { id } = await session.attachments.add("paper.pdf", makePdf(QUOTE));
	const reply = [
		`Real. ${cite(id, 1, QUOTE)}`,
		`Wrong page. ${cite(id, 2, QUOTE)}`,
		`Made up. ${cite(id, 1, "Words the paper never says")}`,
		`Unknown file. ${cite("nope", 1, QUOTE)}`,
	].join(" ");
	engine.faux.setResponses([fauxAssistantMessage(reply)]);
	await session.send({ text: "Why?", attachmentIds: [id] }, () => {}, FAKE_CHOICE);

	const reloaded = await Session.load(engine, dir, session.id);
	const saved = reloaded.view().messages.at(-1)?.blocks[0];
	assert.equal(
		saved?.kind === "text" && saved.text,
		`Real. ${cite(id, 1, QUOTE)} Wrong page.  Made up.  Unknown file. `,
	);
	assert.ok(!reloaded.searchText().includes("<cite"));
	assert.ok(reloaded.searchText().includes("Real."));
});

test("the open page reaches the model but not the learner's message", async () => {
	const dir = await tempDir();
	const engine = createScriptedEngine([fauxAssistantMessage("Sure.")]);
	const session = new Session(engine, dir);
	const { id } = await session.attachments.add("paper.pdf", makePdf(QUOTE));
	await session.send(
		{ text: "Go on", attachmentIds: [], viewing: { attachmentId: id, page: 1 } },
		() => {},
		FAKE_CHOICE,
	);
	const learner = session.view().messages[0];
	assert.deepEqual(learner?.blocks, [{ kind: "text", text: "Go on" }]);
	const log = await readFile(join(dir, "sessions", session.id, "session.jsonl"), "utf8");
	assert.ok(log.includes(`<viewing attachment=\\"${id}\\" page=\\"1\\" />`));
	assert.ok(session.attachments.hasPage(id, 1));
	assert.ok(!session.attachments.hasPage(id, 2));
});

test("a quote across two lines gets one box per line, placed from the top of the page", () => {
	const item = (str: string, y: number) => ({
		str,
		dir: "ltr",
		width: 100,
		height: 10,
		transform: [10, 0, 0, 10, 50, y],
		fontName: "F1",
		hasEOL: true,
	});
	const rects = quoteRects(
		[item("first line ends", 180), item("second line ends", 160)],
		200,
		200,
		"ends second",
	);
	assert.equal(rects.length, 2);
	const [line1, line2] = rects;
	assert.ok(line1 && line2 && line1.top < line2.top);
	assert.ok(line1.left > 0.25, "starts partway along the first line");
	assert.deepEqual(quoteRects([item("first", 180)], 200, 200, "absent"), []);
});

test("stripCitations leaves what the learner reads", () => {
	assert.equal(stripCitations(`One. ${cite("a", 1, "q")}\nTwo.`), "One.\nTwo.");
});
