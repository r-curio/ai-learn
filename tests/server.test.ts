import { fauxAssistantMessage } from "@earendil-works/pi-ai";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createScriptedEngine } from "../src/harness/fake-engine.ts";
import { createApp } from "../src/server/app.ts";
import type { RunEvent } from "../src/shared/protocol.ts";
import { PNG, tempDir } from "./helpers.ts";

const TOKEN = "test-token";
const BASE = "http://127.0.0.1:1234";
const auth = { Authorization: `Bearer ${TOKEN}`, Host: "127.0.0.1:1234" };

async function setup(responses = [fauxAssistantMessage("Hello from the model.")]) {
	return createApp({ engine: createScriptedEngine(responses), dataDir: await tempDir(), token: TOKEN });
}

async function newSession(app: Awaited<ReturnType<typeof setup>>): Promise<string> {
	const response = await app.request(`${BASE}/api/sessions`, { method: "POST", headers: auth });
	return ((await response.json()) as { id: string }).id;
}

function upload(app: Awaited<ReturnType<typeof setup>>, id: string, bytes: Uint8Array, name: string) {
	const form = new FormData();
	form.set("file", new File([bytes as BlobPart], name));
	return app.request(`${BASE}/api/sessions/${id}/attachments`, { method: "POST", headers: auth, body: form });
}

function parseEvents(body: string): RunEvent[] {
	return body
		.split("\n\n")
		.flatMap((frame) => frame.split("\n"))
		.filter((line) => line.startsWith("data:"))
		.map((line) => JSON.parse(line.slice(5)) as RunEvent);
}

test("API calls without the right token are refused", async () => {
	const app = await setup();
	assert.equal((await app.request(`${BASE}/api/status`, { headers: { Host: auth.Host } })).status, 401);
	assert.equal((await app.request(`${BASE}/api/status`, { headers: { Authorization: "Bearer wrong", Host: auth.Host } })).status, 401);
	assert.equal((await app.request(`${BASE}/api/status`, { headers: auth })).status, 200);
});

test("requests aimed at another hostname are refused", async () => {
	const app = await setup();
	const response = await app.request("http://attacker.example/api/status", { headers: { ...auth, Host: "attacker.example" } });
	assert.equal(response.status, 403);
});

test("a message streams back as events", async () => {
	const app = await setup();
	const id = await newSession(app);
	const response = await app.request(`${BASE}/api/sessions/${id}/messages`, {
		method: "POST",
		headers: { ...auth, "Content-Type": "application/json" },
		body: JSON.stringify({ text: "Hi" }),
	});
	assert.equal(response.status, 200);
	const events = parseEvents(await response.text());
	assert.equal(events.flatMap((e) => (e.type === "text_delta" ? [e.delta] : [])).join(""), "Hello from the model.");
	assert.equal(events.at(-1)?.type, "done");
});

test("a file can be uploaded and then sent", async () => {
	const app = await setup();
	const id = await newSession(app);
	const uploaded = await upload(app, id, PNG, "photo.png");
	assert.equal(uploaded.status, 201);
	const info = (await uploaded.json()) as { id: string; kind: string };
	assert.equal(info.kind, "image");
	const response = await app.request(`${BASE}/api/sessions/${id}/messages`, {
		method: "POST",
		headers: { ...auth, "Content-Type": "application/json" },
		body: JSON.stringify({ text: "", attachmentIds: [info.id] }),
	});
	assert.equal(response.status, 200);
});

test("saved chats can be listed, opened, and deleted", async () => {
	const app = await setup([fauxAssistantMessage("Hello."), fauxAssistantMessage("Hello again.")]);
	const id = await newSession(app);
	const empty = (await (await app.request(`${BASE}/api/sessions`, { headers: auth })).json()) as unknown[];
	assert.equal(empty.length, 0);

	const send = await app.request(`${BASE}/api/sessions/${id}/messages`, {
		method: "POST",
		headers: { ...auth, "Content-Type": "application/json" },
		body: JSON.stringify({ text: "What is DNA?" }),
	});
	await send.text();

	const listed = (await (await app.request(`${BASE}/api/sessions`, { headers: auth })).json()) as { id: string; title: string }[];
	assert.deepEqual(listed.map((item) => item.title), ["What is DNA?"]);
	const view = (await (await app.request(`${BASE}/api/sessions/${id}`, { headers: auth })).json()) as { messages: unknown[] };
	assert.equal(view.messages.length, 2);

	assert.equal((await app.request(`${BASE}/api/sessions/${id}`, { method: "DELETE", headers: auth })).status, 200);
	assert.equal((await app.request(`${BASE}/api/sessions/${id}`, { headers: auth })).status, 404);
	assert.equal(((await (await app.request(`${BASE}/api/sessions`, { headers: auth })).json()) as unknown[]).length, 0);
});

test("saved images can be fetched, only with the token", async () => {
	const app = await setup();
	const id = await newSession(app);
	const { id: imageId } = (await (await upload(app, id, PNG, "photo.png")).json()) as { id: string };
	const url = `${BASE}/api/sessions/${id}/attachments/${imageId}`;
	const response = await app.request(url, { headers: auth });
	assert.equal(response.status, 200);
	assert.equal(response.headers.get("content-type"), "image/png");
	assert.deepEqual(new Uint8Array(await response.arrayBuffer()), PNG);
	assert.equal((await app.request(url, { headers: { Host: auth.Host } })).status, 401);
});

test("paths can't escape the sessions folder", async () => {
	const app = await setup();
	for (const id of ["..", "..%2F..", "not-a-uuid"]) {
		assert.equal((await app.request(`${BASE}/api/sessions/${id}`, { headers: auth })).status, 404);
		assert.equal((await app.request(`${BASE}/api/sessions/${id}`, { method: "DELETE", headers: auth })).status, 404);
	}
});

test("bad input gets a clear error", async () => {
	const app = await setup();
	const id = await newSession(app);
	const post = (body: unknown) =>
		app.request(`${BASE}/api/sessions/${id}/messages`, {
			method: "POST",
			headers: { ...auth, "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
	assert.equal((await post({ text: "  " })).status, 400);
	assert.equal((await post({ text: "hi", attachmentIds: ["nope"] })).status, 400);
	assert.equal((await upload(app, id, new Uint8Array([1, 0]), "a.bin")).status, 415);
	assert.equal((await app.request(`${BASE}/api/sessions/none/abort`, { method: "POST", headers: auth })).status, 404);
});

test("a missing API key is reported, not hidden", async () => {
	const engine = createScriptedEngine([]);
	engine.status = () => ({ ready: false, model: "x", reason: "ANTHROPIC_API_KEY is not set." });
	const app = createApp({ engine, dataDir: await tempDir(), token: TOKEN });
	const id = await newSession(app);
	const response = await app.request(`${BASE}/api/sessions/${id}/messages`, {
		method: "POST",
		headers: { ...auth, "Content-Type": "application/json" },
		body: JSON.stringify({ text: "Hi" }),
	});
	assert.equal(response.status, 503);
});
