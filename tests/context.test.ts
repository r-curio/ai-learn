import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createScriptedEngine } from "../src/harness/fake-engine.ts";
import { readLog } from "../src/harness/sessions/log.ts";
import { Session } from "../src/harness/sessions/session.ts";
import type { ContextUsage, RunEvent } from "../src/shared/protocol.ts";
import { FAKE_CHOICE, tempDir } from "./helpers.ts";
import { join } from "node:path";

const FAKE_LIMIT = FAKE_CHOICE.model.contextWindow;

async function send(session: Session, text: string): Promise<ContextUsage | undefined> {
	const events: RunEvent[] = [];
	await session.send({ text, attachmentIds: [] }, (event) => events.push(event), FAKE_CHOICE);
	const done = events.at(-1);
	assert.equal(done?.type, "done");
	return done.type === "done" ? done.context : undefined;
}

/** What each saved reply reports it was sent, in order. */
async function savedInputSizes(dir: string, id: string): Promise<number[]> {
	const entries = await readLog(join(dir, "sessions", id, "session.jsonl"));
	return entries.flatMap((entry) => {
		if (entry.type !== "message" || entry.message.role !== "assistant") return [];
		const { input, cacheRead, cacheWrite } = entry.message.usage;
		return [input + cacheRead + cacheWrite];
	});
}

test("a new chat has no context until a model call reports one", async () => {
	const engine = createScriptedEngine([]);
	assert.equal(new Session(engine, await tempDir()).view().context, undefined);
});

test("context is the last call's input, not a running total, and survives a reload", async () => {
	const dir = await tempDir();
	const engine = createScriptedEngine([
		fauxAssistantMessage("First."),
		fauxAssistantMessage(fauxToolCall("read_attachment", { id: "missing" }), {
			stopReason: "toolUse",
		}),
		fauxAssistantMessage("Second."),
	]);
	const session = new Session(engine, dir);
	await send(session, "One");
	const context = await send(session, "Two");

	const sizes = await savedInputSizes(dir, session.id);
	assert.equal(sizes.length, 3);
	assert.deepEqual(context, { tokens: sizes.at(-1), limit: FAKE_LIMIT });
	assert.ok((context?.tokens ?? 0) < sizes.reduce((sum, size) => sum + size, 0));
	assert.deepEqual(session.view().context, context);

	const reloaded = await Session.load(engine, dir, session.id);
	assert.deepEqual(reloaded.view().context, context);
});

test("a reply that reports no input keeps the last known context", async () => {
	const dir = await tempDir();
	const engine = createScriptedEngine([
		fauxAssistantMessage("Fine."),
		() => {
			throw new Error("The provider is down.");
		},
	]);
	const session = new Session(engine, dir);
	const before = await send(session, "One");
	assert.ok((before?.tokens ?? 0) > 0);

	const after = await send(session, "Two");
	const sizes = await savedInputSizes(dir, session.id);
	assert.equal(sizes.at(-1), 0, "the failed reply should report nothing");
	assert.deepEqual(after, before);

	const reloaded = await Session.load(engine, dir, session.id);
	assert.deepEqual(reloaded.view().context, before);
});

test("a model gone from the catalog still reports its tokens, with no limit", async () => {
	const dir = await tempDir();
	const engine = createScriptedEngine([fauxAssistantMessage("Fine.")]);
	const session = new Session(engine, dir);
	const context = await send(session, "One");

	const later = { ...engine, contextLimit: () => undefined };
	const reloaded = await Session.load(later, dir, session.id);
	assert.deepEqual(reloaded.view().context, { tokens: context?.tokens, limit: undefined });
});
