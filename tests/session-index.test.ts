import { fauxAssistantMessage } from "@earendil-works/pi-ai";
import assert from "node:assert/strict";
import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { createScriptedEngine } from "../src/harness/fake-engine.ts";
import type { Session } from "../src/harness/sessions/session.ts";
import { SessionStore } from "../src/harness/sessions/store.ts";
import { tempDir } from "./helpers.ts";

const indexPath = (dir: string) => join(dir, "session-index.sqlite");

const newStore = (dir: string) =>
	new SessionStore(createScriptedEngine([fauxAssistantMessage("Fine.")]), dir);

const ask = (session: Session, text: string) => session.send({ text, attachmentIds: [] }, () => {});

async function storeWithOneChat(dir: string) {
	const store = newStore(dir);
	const session = store.create();
	await ask(session, "Why is the sky blue?");
	return { store, session };
}

test("a finished reply shows in the list, and deleting removes it", async () => {
	const { store, session } = await storeWithOneChat(await tempDir());
	assert.deepEqual(
		(await store.list()).map((summary) => summary.id),
		[session.id],
	);
	assert.equal(await store.delete(session.id), true);
	assert.deepEqual(await store.list(), []);
});

test("a deleted index is rebuilt from the session folders", async () => {
	const dir = await tempDir();
	const { session } = await storeWithOneChat(dir);
	await rm(indexPath(dir));
	const [summary] = await newStore(dir).list();
	assert.equal(summary?.id, session.id);
	assert.match(summary?.title ?? "", /sky/);
});

test("a damaged index is replaced, and the chats are still listed", async () => {
	const dir = await tempDir();
	const { session } = await storeWithOneChat(dir);
	await writeFile(indexPath(dir), "this is not a database, it's long enough to be read as one");
	const [summary] = await newStore(dir).list();
	assert.equal(summary?.id, session.id);
});

test("a chat removed from disk while the app was closed leaves the list", async () => {
	const dir = await tempDir();
	const { store, session } = await storeWithOneChat(dir);
	await store.list();
	await rm(join(dir, "sessions", session.id), { recursive: true });
	assert.deepEqual(await newStore(dir).list(), []);
});
