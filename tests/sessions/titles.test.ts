import { fauxAssistantMessage, fauxText, fauxToolCall } from "@earendil-works/pi-ai";
import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import type { Engine } from "../../src/harness/engine.ts";
import { createScriptedEngine } from "../../src/harness/fake-engine.ts";
import { FINISH_PROBE } from "../../src/harness/prompts/finish-probe.ts";
import { readLog } from "../../src/harness/sessions/log.ts";
import { Session } from "../../src/harness/sessions/session.ts";
import { SessionStore } from "../../src/harness/sessions/store.ts";
import type { TitleSource } from "../../src/harness/title.ts";
import { cleanTitle } from "../../src/harness/title.ts";
import type { RunEvent } from "../../src/shared/protocol.ts";
import { FAKE_CHOICE, tempDir } from "../helpers.ts";

type Replies = Parameters<typeof createScriptedEngine>[0];

/** A scripted engine whose title calls are answered by `writeTitle`, and recorded. */
function titledEngine(replies: Replies, writeTitle: Engine["writeTitle"]) {
	const engine = createScriptedEngine(replies);
	const asked: TitleSource[] = [];
	engine.writeTitle = (model, source) => {
		asked.push(source);
		return writeTitle(model, source);
	};
	return { engine, asked };
}

function say(session: Session, text: string) {
	const events: RunEvent[] = [];
	const done = session.send(
		{ text, attachmentIds: [] },
		(event) => events.push(event),
		FAKE_CHOICE,
	);
	return { events, done };
}

const titleRecords = async (dir: string, id: string) =>
	(await readLog(join(dir, "sessions", id, "session.jsonl"))).filter(
		(entry) => entry.type === "title",
	);

const FIRST = "Can you help me with something? I keep mixing up mitosis and meiosis.";

test("a Practice chat is named after its first reply, and later messages keep that title", async () => {
	const dir = await tempDir();
	const { engine, asked } = titledEngine(
		[fauxAssistantMessage("Mitosis copies a cell."), fauxAssistantMessage("Meiosis halves it.")],
		async () => "Mitosis versus meiosis",
	);
	const session = new Session(engine, dir);
	session.chooseType("practice");
	const first = say(session, FIRST);
	await first.done;

	assert.deepEqual(asked, [{ learner: FIRST, reply: "Mitosis copies a cell." }]);
	const types = first.events.map((event) => event.type);
	assert.deepEqual(types.slice(-2), ["done", "title"], "the title follows done");
	assert.equal(session.view().title, "Mitosis versus meiosis");
	const summary = JSON.parse(
		await readFile(join(dir, "sessions", session.id, "summary.json"), "utf8"),
	) as { title: string };
	assert.equal(summary.title, "Mitosis versus meiosis");

	await say(session, "And meiosis?").done;
	assert.equal(asked.length, 1, "only the first reply asks for a title");
	assert.equal(session.view().title, "Mitosis versus meiosis");
});

test("a failed title call keeps the first-message title and shows nothing", async () => {
	const dir = await tempDir();
	const { engine } = titledEngine([fauxAssistantMessage("Sure.")], async () => {
		throw new Error("No model available.");
	});
	const session = new Session(engine, dir);
	const { events, done } = say(session, FIRST);
	await done;

	assert.equal(session.view().title, `${FIRST.slice(0, 59)}…`);
	assert.deepEqual(await titleRecords(dir, session.id), []);
	const end = events.find((event) => event.type === "done");
	assert.equal(end?.type === "done" && end.stopReason, "stop");
	assert.ok(!events.some((event) => event.type === "title"));
});

test("a finished probe's goal becomes the title during the run, over the first reply's title", async () => {
	const dir = await tempDir();
	const goal = "How meiosis makes four different cells";
	const probeEnds = fauxAssistantMessage(
		[fauxText("Got it."), fauxToolCall(FINISH_PROBE, { goal, threads: [] })],
		{ stopReason: "toolUse" },
	);
	const { engine, asked } = titledEngine(
		[fauxAssistantMessage("What do you know already?"), probeEnds, fauxAssistantMessage("Ready.")],
		async () => "Cell division",
	);
	const session = new Session(engine, dir);
	await say(session, FIRST).done;
	assert.equal(session.view().title, "Cell division");

	const second = say(session, "Skip the questions, please.");
	await second.done;
	const types = second.events.map((event) => event.type);
	assert.ok(types.indexOf("title") < types.indexOf("done"), "the goal arrives before done");
	assert.equal(session.view().title, goal);
	assert.equal(asked.length, 1);

	const reopened = await Session.load(engine, dir, session.id);
	assert.equal(reopened.view().title, goal);
});

test("a title survives a restart and a rebuilt index, and search finds it", async () => {
	const dir = await tempDir();
	const { engine } = titledEngine(
		[fauxAssistantMessage("Sure.")],
		async () => "Photosynthesis in leaves",
	);
	const session = new SessionStore(engine, dir).create();
	await say(session, FIRST).done;

	await rm(join(dir, "session-index.sqlite"));
	await rm(join(dir, "sessions", session.id, "summary.json"));
	const store = new SessionStore(createScriptedEngine([]), dir);
	assert.deepEqual(
		(await store.list()).map((summary) => summary.title),
		["Photosynthesis in leaves"],
	);
	assert.deepEqual(
		(await store.search("photosynth")).map((result) => result.id),
		[session.id],
	);
});

test("a learner's rename before the tutor's title arrives is kept, and the tutor's is dropped", async () => {
	const dir = await tempDir();
	let release: (title: string) => void = () => undefined;
	let called: () => void = () => undefined;
	const asking = new Promise<void>((resolve) => (called = resolve));
	const { engine } = titledEngine(
		[fauxAssistantMessage("Sure.")],
		() =>
			new Promise((resolve) => {
				release = resolve;
				called();
			}),
	);
	const store = new SessionStore(engine, dir);
	const session = store.create();
	const { events, done } = say(session, FIRST);
	await asking;
	assert.equal(await session.rename("  My   biology notes "), "My biology notes");
	release("Tutor's title");
	await done;

	assert.equal(session.view().title, "My biology notes");
	assert.ok(!events.some((event) => event.type === "title"));
	const records = await titleRecords(dir, session.id);
	assert.deepEqual(
		records.map((record) => record.type === "title" && [record.by, record.title]),
		[["learner", "My biology notes"]],
	);

	const restarted = new SessionStore(createScriptedEngine([]), dir);
	assert.equal((await restarted.list())[0]?.title, "My biology notes");
	assert.equal((await restarted.search("biology notes"))[0]?.id, session.id);
});

test("an empty rename is refused, and so is one before anything is saved", async () => {
	const dir = await tempDir();
	const { engine } = titledEngine([fauxAssistantMessage("Sure.")], async () => undefined);
	const session = new Session(engine, dir);
	await assert.rejects(session.rename("Early"), /Send a message/);
	await say(session, FIRST).done;
	await assert.rejects(session.rename("   "), /needs a title/);
	assert.deepEqual(await titleRecords(dir, session.id), []);
});

test("a chat saved before titles keeps its first-message title", async () => {
	const dir = await tempDir();
	const id = "33333333-3333-4333-8333-333333333333";
	const log = [
		{ type: "header", version: 2, id, createdAt: 1, systemPrompt: "Old.", chatType: "practice" },
		{
			type: "message",
			message: { role: "user", content: "Why is the sky blue?", timestamp: 1 },
			display: { text: "Why is the sky blue?", attachmentIds: [] },
		},
		{ type: "message", message: { ...fauxAssistantMessage("Scattering."), timestamp: 2 } },
	];
	await mkdir(join(dir, "sessions", id), { recursive: true });
	await writeFile(
		join(dir, "sessions", id, "session.jsonl"),
		`${log.map((entry) => JSON.stringify(entry)).join("\n")}\n`,
	);
	const { engine, asked } = titledEngine([fauxAssistantMessage("Sunsets too.")], async () => "New");
	const session = await Session.load(engine, dir, id);
	await say(session, "And at sunset?").done;
	assert.deepEqual(asked, []);
	assert.equal(session.view().title, "Why is the sky blue?");
});

test("a written title is cut to one tidy line", () => {
	assert.equal(cleanTitle('"Mitosis vs meiosis."\nExtra'), "Mitosis vs meiosis");
	assert.equal(cleanTitle("**Title:** Light"), "Light");
	assert.equal(cleanTitle("   "), undefined);
	assert.ok((cleanTitle("word ".repeat(40)) ?? "").length <= 80);
});
