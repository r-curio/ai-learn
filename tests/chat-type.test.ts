import { fauxAssistantMessage } from "@earendil-works/pi-ai";
import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { createScriptedEngine } from "../src/harness/fake-engine.ts";
import { readLog } from "../src/harness/sessions/log.ts";
import { SessionStore } from "../src/harness/sessions/store.ts";
import { createApp } from "../src/server/app.ts";
import { FAKE_CHOICE, tempDir } from "./helpers.ts";

const FAKE_MODEL = { provider: "faux", id: "fake-model", effort: "medium" };
const OLD_ID = "11111111-1111-4111-8111-111111111111";

const newStore = (dir: string, replies = 1) =>
	new SessionStore(
		createScriptedEngine(Array.from({ length: replies }, () => fauxAssistantMessage("Fine."))),
		dir,
	);

/** A chat exactly as saved before chat types: no type in its log or summary. */
async function writeOldChat(dir: string): Promise<string> {
	const folder = join(dir, "sessions", OLD_ID);
	await mkdir(folder, { recursive: true });
	const log = `${[
		{ type: "header", version: 1, id: OLD_ID, createdAt: 1, systemPrompt: "Old prompt." },
		{
			type: "message",
			message: { role: "user", content: "Why is the sky blue?", timestamp: 1 },
			display: { text: "Why is the sky blue?", attachmentIds: [] },
		},
		{ type: "message", message: { ...fauxAssistantMessage("Scattering."), timestamp: 2 } },
	]
		.map((entry) => JSON.stringify(entry))
		.join("\n")}\n`;
	await writeFile(join(folder, "session.jsonl"), log);
	await writeFile(
		join(folder, "summary.json"),
		JSON.stringify({ id: OLD_ID, title: "Why is the sky blue?", updatedAt: 2 }),
	);
	return log;
}

/** An index file as it was before the chat type column. */
function writeOldIndex(dir: string): void {
	const db = new DatabaseSync(join(dir, "session-index.sqlite"));
	db.exec(
		"CREATE TABLE sessions (id TEXT PRIMARY KEY, title TEXT NOT NULL, updated_at INTEGER NOT NULL)",
	);
	db.prepare("INSERT INTO sessions VALUES (?, ?, ?)").run(OLD_ID, "Why is the sky blue?", 2);
	db.close();
}

async function practiceChat(dir: string): Promise<string> {
	const session = newStore(dir).create();
	session.chooseType("practice");
	await session.send({ text: "Quiz me", attachmentIds: [] }, () => {}, FAKE_CHOICE);
	return session.id;
}

test("an old chat with no type opens, shows as Learning, and its log isn't changed", async () => {
	const dir = await tempDir();
	const log = await writeOldChat(dir);
	writeOldIndex(dir);

	const store = newStore(dir);
	const [summary] = await store.list();
	assert.equal(summary?.id, OLD_ID);
	assert.equal(summary?.chatType, "learning");

	const session = await store.get(OLD_ID);
	assert.equal(session?.view().messages.length, 2);
	assert.equal(session?.summary().chatType, "learning");
	assert.equal(await readFile(join(dir, "sessions", OLD_ID, "session.jsonl"), "utf8"), log);
});

test("a new old-chat reply keeps the old log's header and adds no type", async () => {
	const dir = await tempDir();
	const log = await writeOldChat(dir);
	const session = await newStore(dir).get(OLD_ID);
	session?.chooseType("practice");
	await session?.send({ text: "And at sunset?", attachmentIds: [] }, () => {}, FAKE_CHOICE);

	const after = await readFile(join(dir, "sessions", OLD_ID, "session.jsonl"), "utf8");
	assert.ok(after.startsWith(log));
	assert.equal(session?.summary().chatType, "learning");
});

test("the type is saved in the log, so it survives losing the index and summary", async () => {
	const dir = await tempDir();
	const id = await practiceChat(dir);
	const [header] = await readLog(join(dir, "sessions", id, "session.jsonl"));
	assert.equal(header?.type === "header" && header.chatType, "practice");

	await rm(join(dir, "session-index.sqlite"));
	await rm(join(dir, "sessions", id, "summary.json"));
	const [summary] = await newStore(dir).list();
	assert.equal(summary?.id, id);
	assert.equal(summary?.chatType, "practice");
});

test("the type can't change after the first message", async () => {
	const dir = await tempDir();
	const store = newStore(dir, 2);
	const session = store.create();
	session.chooseType("practice");
	await session.send({ text: "One", attachmentIds: [] }, () => {}, FAKE_CHOICE);
	session.chooseType("learning");
	await session.send({ text: "Two", attachmentIds: [] }, () => {}, FAKE_CHOICE);
	assert.equal(session.summary().chatType, "practice");
});

test("search results carry the chat's type", async () => {
	const dir = await tempDir();
	await practiceChat(dir);
	const [result] = await newStore(dir).search("Quiz");
	assert.equal(result?.chatType, "practice");
});

test("the server saves the first message's type and rejects an unknown one", async () => {
	const TOKEN = "test-token";
	const BASE = "http://127.0.0.1:1234";
	const auth = { Authorization: `Bearer ${TOKEN}`, Host: "127.0.0.1:1234" };
	const dir = await tempDir();
	const engine = createScriptedEngine([fauxAssistantMessage("Fine.")]);
	const app = createApp({ engine, dataDir: dir, token: TOKEN });
	const created = await app.request(`${BASE}/api/sessions`, { method: "POST", headers: auth });
	const { id } = (await created.json()) as { id: string };
	const post = (chatType: string) =>
		app.request(`${BASE}/api/sessions/${id}/messages`, {
			method: "POST",
			headers: { ...auth, "Content-Type": "application/json" },
			body: JSON.stringify({
				text: "Quiz me",
				model: FAKE_MODEL,
				chatType,
			}),
		});

	assert.equal((await post("homework")).status, 400);
	const response = await post("practice");
	assert.equal(response.status, 200);
	await response.text();
	const [summary] = (await (
		await app.request(`${BASE}/api/sessions`, { headers: auth })
	).json()) as { chatType: string }[];
	assert.equal(summary?.chatType, "practice");
});
