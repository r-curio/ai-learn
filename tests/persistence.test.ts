import {
	fauxAssistantMessage,
	fauxToolCall,
	type FauxResponseFactory,
} from "@earendil-works/pi-ai";
import assert from "node:assert/strict";
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { createScriptedEngine } from "../src/harness/fake-engine.ts";
import { readLog, SessionLogError } from "../src/harness/sessions/log.ts";
import { Session } from "../src/harness/sessions/session.ts";
import type { RunEvent } from "../src/shared/protocol.ts";
import { FAKE_CHOICE, PNG, tempDir } from "./helpers.ts";

const logPath = (dir: string, id: string) => join(dir, "sessions", id, "session.jsonl");

async function run(
	session: Session,
	text: string,
	attachmentIds: string[] = [],
): Promise<RunEvent[]> {
	const events: RunEvent[] = [];
	await session.send({ text, attachmentIds }, (event) => events.push(event), FAKE_CHOICE);
	return events;
}

const streamed = (events: RunEvent[]) =>
	events.flatMap((event) => (event.type === "text_delta" ? [event.delta] : [])).join("");

/** A response step that records exactly what would be sent to the model. */
function capture(into: unknown[], reply: string): FauxResponseFactory {
	return (context) => {
		into.push(structuredClone({ messages: context.messages }));
		return fauxAssistantMessage(reply);
	};
}

test("a reloaded session sends the model byte-identical history", async () => {
	const dir = await tempDir();
	const seen: { messages: unknown[] }[] = [];
	const first = createScriptedEngine([capture(seen, "One."), capture(seen, "Two.")]);
	const session = new Session(first, dir);
	const big = new Uint8Array(200_000);
	big.set(PNG);
	const image = await session.attachments.add("pic.png", big);
	await run(session, "First", [image.id]);
	await run(session, "Second");

	// The image is stored as a reference, so it isn't copied into the log.
	const log = await readFile(logPath(dir, session.id), "utf8");
	assert.ok(log.length < 10_000, `log was ${log.length} bytes`);
	assert.match(log, new RegExp(`"attachmentId":"${image.id}"`));

	const second = createScriptedEngine([capture(seen, "Three.")]);
	const reloaded = await Session.load(second, dir, session.id);
	await run(reloaded, "Third");

	const before = seen[1]!.messages;
	const after = seen[2]!.messages;
	const withoutTimestamps = (value: unknown) =>
		JSON.stringify(value, (key, field: unknown) => (key === "durationMs" ? undefined : field));
	assert.equal(withoutTimestamps(after.slice(0, before.length)), withoutTimestamps(before));
	assert.ok(after.length > before.length);
	assert.equal((after[0] as { role: string }).role, "system");
});

test("a crash before the reply can be retried", async () => {
	const dir = await tempDir();
	const session = new Session(
		createScriptedEngine([fauxAssistantMessage("Lost in the crash.")]),
		dir,
	);
	await run(session, "Hello");
	const lines = (await readFile(logPath(dir, session.id), "utf8")).split("\n").filter(Boolean);
	await writeFile(logPath(dir, session.id), `${lines.slice(0, 2).join("\n")}\n`);

	const reloaded = await Session.load(
		createScriptedEngine([fauxAssistantMessage("Recovered.")]),
		dir,
		session.id,
	);
	const view = reloaded.view();
	assert.equal(view.canRetry, true);
	assert.match(view.messages.at(-1)?.notice ?? "", /closed before/);

	const events: RunEvent[] = [];
	await reloaded.retry((event) => events.push(event), FAKE_CHOICE);
	assert.equal(streamed(events), "Recovered.");
	assert.equal(reloaded.view().canRetry, false);
	assert.equal(reloaded.view().messages.at(-1)?.notice, undefined);
});

test("a tool cut off by a crash gets an error result and is never rerun", async () => {
	const dir = await tempDir();
	const engine = createScriptedEngine([]);
	const session = new Session(engine, dir);
	const notes = await session.attachments.add("notes.txt", new TextEncoder().encode("facts"));
	engine.faux.setResponses([
		fauxAssistantMessage(fauxToolCall("read_attachment", { id: notes.id }, { id: "call-1" }), {
			stopReason: "toolUse",
		}),
		fauxAssistantMessage("Done."),
	]);
	await run(session, "Read");
	const lines = (await readFile(logPath(dir, session.id), "utf8")).split("\n").filter(Boolean);
	const cut = lines.findIndex((line) => line.includes('"role":"toolResult"'));
	await writeFile(logPath(dir, session.id), `${lines.slice(0, cut).join("\n")}\n`);

	const seen: { messages: { role: string; isError?: boolean }[] }[] = [];
	const reloaded = await Session.load(
		createScriptedEngine([capture(seen, "Recovered.")]),
		dir,
		session.id,
	);
	const events: RunEvent[] = [];
	await reloaded.retry((event) => events.push(event), FAKE_CHOICE);
	assert.equal(
		events.some((event) => event.type === "tool_start"),
		false,
	);
	const result = seen[0]?.messages.find((message) => message.role === "toolResult");
	assert.equal(result?.isError, true);
	const view = reloaded.view();
	const tool = view.messages.at(-1)?.blocks.find((block) => block.kind === "tool");
	assert.ok(tool?.kind === "tool" && tool.state === "failed");
});

test("a half-written last line is trimmed, and appending still works", async () => {
	const dir = await tempDir();
	const session = new Session(createScriptedEngine([fauxAssistantMessage("Fine.")]), dir);
	await run(session, "Hello");
	await appendFile(logPath(dir, session.id), '{"type":"message","message":{"role":"assis');

	const reloaded = await Session.load(
		createScriptedEngine([fauxAssistantMessage("Still fine.")]),
		dir,
		session.id,
	);
	assert.equal(reloaded.view().canRetry, false);
	await run(reloaded, "Again");
	const entries = await readLog(logPath(dir, session.id));
	assert.equal(entries.filter((entry) => entry.type === "message").length, 4);
});

test("damage in the middle of a log is reported, not hidden", async () => {
	const dir = await tempDir();
	const session = new Session(createScriptedEngine([fauxAssistantMessage("Fine.")]), dir);
	await run(session, "Hello");
	const lines = (await readFile(logPath(dir, session.id), "utf8")).split("\n");
	lines[1] = "not json";
	await writeFile(logPath(dir, session.id), lines.join("\n"));
	await assert.rejects(Session.load(createScriptedEngine([]), dir, session.id), SessionLogError);
});

test("a log from a newer version is refused", async () => {
	const dir = await tempDir();
	const session = new Session(createScriptedEngine([fauxAssistantMessage("Fine.")]), dir);
	await run(session, "Hello");
	const path = logPath(dir, session.id);
	await writeFile(path, (await readFile(path, "utf8")).replace('"version":1', '"version":99'));
	await assert.rejects(Session.load(createScriptedEngine([]), dir, session.id), /newer version/);
});

test("a failed reply can be retried, and the failure isn't resent or shown", async () => {
	const dir = await tempDir();
	const seen: { messages: { role: string }[] }[] = [];
	const engine = createScriptedEngine([
		fauxAssistantMessage("", { stopReason: "error", errorMessage: "Overloaded" }),
		capture(seen, "Worked."),
	]);
	const session = new Session(engine, dir);
	await run(session, "Hello");
	assert.equal(session.view().canRetry, true);
	assert.equal(session.view().messages.at(-1)?.notice, "Overloaded");

	const events: RunEvent[] = [];
	await session.retry((event) => events.push(event), FAKE_CHOICE);
	assert.equal(streamed(events), "Worked.");
	assert.equal(seen[0]?.messages.filter((message) => message.role === "assistant").length, 0);

	for (const view of [
		session.view(),
		(await Session.load(createScriptedEngine([]), dir, session.id)).view(),
	]) {
		assert.equal(view.canRetry, false);
		assert.equal(view.messages.at(-1)?.notice, undefined);
		assert.deepEqual(view.messages.at(-1)?.blocks, [{ kind: "text", text: "Worked." }]);
	}
});

test("a stopped reply stays visible but isn't retried or resent", async () => {
	const dir = await tempDir();
	// Pi drops stopped replies inside its provider layer, just before the API call.
	const seen: { messages: { role: string; stopReason?: string }[] }[] = [];
	const engine = createScriptedEngine(
		[fauxAssistantMessage("word ".repeat(400)), capture(seen, "Next.")],
		300,
	);
	const session = new Session(engine, dir);
	await session.send(
		{ text: "Go", attachmentIds: [] },
		(event) => {
			if (event.type === "text_delta") session.abort();
		},
		FAKE_CHOICE,
	);
	const reloaded = await Session.load(engine, dir, session.id);
	assert.equal(reloaded.view().canRetry, false);
	assert.equal(reloaded.view().messages.at(-1)?.notice, "Stopped.");
	await run(reloaded, "Continue");
	const replies = seen[0]?.messages.filter((message) => message.role === "assistant") ?? [];
	assert.deepEqual(
		replies.map((reply) => reply.stopReason),
		["aborted"],
	);
});
