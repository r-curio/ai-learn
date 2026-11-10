import { fauxAssistantMessage } from "@earendil-works/pi-ai";
import assert from "node:assert/strict";
import { appendFile, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { createScriptedEngine } from "../../src/harness/fake-engine.ts";
import type { Session } from "../../src/harness/sessions/session.ts";
import { SessionStore } from "../../src/harness/sessions/store.ts";
import { FAKE_CHOICE, tempDir } from "../helpers.ts";

const indexPath = (dir: string) => join(dir, "session-index.sqlite");

const newStore = (dir: string) =>
	new SessionStore(createScriptedEngine([fauxAssistantMessage("Fine.")]), dir);

const ask = (session: Session, text: string) =>
	session.send({ text, attachmentIds: [] }, () => {}, FAKE_CHOICE);

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

const foundIds = async (store: SessionStore, typed: string) =>
	(await store.search(typed)).map((result) => result.id);

test("search finds message text, with the match marked in the snippet", async () => {
	const { store, session } = await storeWithOneChat(await tempDir());
	const [result, ...others] = await store.search("sky");
	assert.equal(result?.id, session.id);
	assert.equal(others.length, 0);
	assert.deepEqual(
		result?.snippet.filter((part) => part.match).map((part) => part.text),
		["sky"],
	);
	assert.deepEqual(await foundIds(store, "fin"), [session.id], "replies match, and so do prefixes");
	assert.deepEqual(await foundIds(store, "photosynthesis"), []);
});

test("characters that mean something to FTS5 can't break a search", async () => {
	const { store, session } = await storeWithOneChat(await tempDir());
	for (const typed of [
		'"',
		'""',
		"*",
		"(",
		")",
		"sky*",
		'sky"',
		"AND",
		"NOT sky",
		"a:b",
		"\0",
		"-",
	]) {
		await assert.doesNotReject(store.search(typed), `searching for ${JSON.stringify(typed)}`);
	}
	assert.deepEqual(await foundIds(store, 'sky"'), [session.id]);
	assert.deepEqual(await foundIds(store, "   "), []);
});

test("deleting the index and relaunching gives the same results", async () => {
	const dir = await tempDir();
	const { store } = await storeWithOneChat(dir);
	const second = store.create();
	await ask(second, "Is the sky ever green?");
	const before = await store.search("sky");
	assert.equal(before.length, 2);
	await rm(indexPath(dir));
	assert.deepEqual(await newStore(dir).search("sky"), before);
});

test("a launch only rereads a log when its summary date changed", async () => {
	const dir = await tempDir();
	const { session } = await storeWithOneChat(dir);
	const folder = join(dir, "sessions", session.id);
	const extra = {
		type: "message",
		message: { role: "user", content: "marmalade", timestamp: 0 },
		display: { text: "marmalade", attachmentIds: [] },
	};
	await appendFile(join(folder, "session.jsonl"), `${JSON.stringify(extra)}\n`);
	assert.deepEqual(await foundIds(newStore(dir), "marmalade"), [], "the summary didn't change");

	const summary = JSON.parse(await readFile(join(folder, "summary.json"), "utf8")) as {
		updatedAt: number;
	};
	await writeFile(
		join(folder, "summary.json"),
		JSON.stringify({ ...summary, updatedAt: summary.updatedAt + 1 }),
	);
	assert.deepEqual(await foundIds(newStore(dir), "marmalade"), [session.id]);
});

test("attachment contents aren't searchable, live or after a rebuild", async () => {
	const dir = await tempDir();
	const store = newStore(dir);
	const session = store.create();
	const file = await session.attachments.add(
		"notes.txt",
		Buffer.from("zebrafish are mentioned only in this file"),
	);
	await session.send(
		{ text: "Summarize my notes", attachmentIds: [file.id] },
		() => {},
		FAKE_CHOICE,
	);
	assert.deepEqual(await foundIds(store, "zebrafish"), []);
	assert.deepEqual(await foundIds(store, "summarize"), [session.id]);
	await rm(indexPath(dir));
	assert.deepEqual(await foundIds(newStore(dir), "zebrafish"), []);
});

test("searching doesn't repair a log a reply may still be writing", async () => {
	const dir = await tempDir();
	const { session } = await storeWithOneChat(dir);
	const log = join(dir, "sessions", session.id, "session.jsonl");
	await appendFile(log, '{"type":"mess');
	const before = await readFile(log);
	await rm(indexPath(dir));
	assert.deepEqual(await foundIds(newStore(dir), "sky"), [session.id]);
	assert.deepEqual(await readFile(log), before);
});

test("a deleted chat leaves the search results", async () => {
	const { store, session } = await storeWithOneChat(await tempDir());
	assert.equal((await store.search("sky")).length, 1);
	await store.delete(session.id);
	assert.deepEqual(await store.search("sky"), []);
});
