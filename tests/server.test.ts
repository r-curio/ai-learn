import { fauxAssistantMessage } from "@earendil-works/pi-ai";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { createScriptedEngine } from "../src/harness/fake-engine.ts";
import { createApp } from "../src/server/app.ts";
import { PNG, tempDir } from "./helpers.ts";

const TOKEN = "test-token";
const BASE = "http://127.0.0.1:1234";
const auth = { Authorization: `Bearer ${TOKEN}`, Host: "127.0.0.1:1234" };

async function setup(responses = [fauxAssistantMessage("Hello from the model.")]) {
	return createApp({
		engine: createScriptedEngine(responses),
		dataDir: await tempDir(),
		token: TOKEN,
	});
}

async function newSession(app: Awaited<ReturnType<typeof setup>>): Promise<string> {
	const response = await app.request(`${BASE}/api/sessions`, { method: "POST", headers: auth });
	return ((await response.json()) as { id: string }).id;
}

function upload(
	app: Awaited<ReturnType<typeof setup>>,
	id: string,
	bytes: Uint8Array,
	name: string,
) {
	const form = new FormData();
	form.set("file", new File([bytes as BlobPart], name));
	return app.request(`${BASE}/api/sessions/${id}/attachments`, {
		method: "POST",
		headers: auth,
		body: form,
	});
}

test("API calls without the right token are refused", async () => {
	const app = await setup();
	assert.equal(
		(await app.request(`${BASE}/api/status`, { headers: { Host: auth.Host } })).status,
		401,
	);
	assert.equal(
		(
			await app.request(`${BASE}/api/status`, {
				headers: { Authorization: "Bearer wrong", Host: auth.Host },
			})
		).status,
		401,
	);
	assert.equal((await app.request(`${BASE}/api/status`, { headers: auth })).status, 200);
});

test("requests aimed at another hostname are refused", async () => {
	const app = await setup();
	const response = await app.request("http://attacker.example/api/status", {
		headers: { ...auth, Host: "attacker.example" },
	});
	assert.equal(response.status, 403);
});

test("saved images can be fetched, only with the token", async () => {
	const app = await setup();
	const id = await newSession(app);
	const { id: imageId } = (await (await upload(app, id, PNG, "photo.png")).json()) as {
		id: string;
	};
	const url = `${BASE}/api/sessions/${id}/attachments/${imageId}`;
	const response = await app.request(url, { headers: auth });
	assert.equal(response.status, 200);
	assert.equal(response.headers.get("content-type"), "image/png");
	assert.deepEqual(new Uint8Array(await response.arrayBuffer()), PNG);
	assert.equal((await app.request(url, { headers: { Host: auth.Host } })).status, 401);
});

test("paths can't escape the sessions folder", async () => {
	const dataDir = await tempDir();
	const app = createApp({ engine: createScriptedEngine([]), dataDir, token: TOKEN });
	// A readable session outside sessions/, so an escaped path would really find it.
	const outside = join(dataDir, "outside");
	await mkdir(outside);
	const header = { type: "header", version: 1, id: "x", createdAt: 0, systemPrompt: "" };
	await writeFile(join(outside, "session.jsonl"), `${JSON.stringify(header)}\n`);

	for (const id of ["..%2Foutside", "not-a-uuid"]) {
		const url = `${BASE}/api/sessions/${id}`;
		assert.equal((await app.request(url, { headers: auth })).status, 404);
		assert.equal((await app.request(url, { method: "DELETE", headers: auth })).status, 404);
	}
	assert.ok(existsSync(join(outside, "session.jsonl")));
});
