import type { Models } from "@earendil-works/pi-ai";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createDemoEngine } from "../src/harness/fake-engine.ts";
import { transcribeInCloud, VoiceError } from "../src/harness/transcription.ts";
import { createApp } from "../src/server/app.ts";
import { tempDir } from "./helpers.ts";

const KEY = "sk-test-secret-key";
const TOKEN = "test-token";
const BASE = "http://127.0.0.1:1234";
const auth = { Authorization: `Bearer ${TOKEN}`, Host: "127.0.0.1:1234" };
const RECORDING = { audio: new Uint8Array([1, 2, 3]), mimeType: "audio/webm" };

const modelsWithKey = { getAuth: async () => ({ auth: { apiKey: KEY } }) } as unknown as Models;

/** Replace `fetch` for one call, recording what was sent. */
function stubFetch(response: Response) {
	const sent: { url: string; init?: RequestInit }[] = [];
	const original = globalThis.fetch;
	globalThis.fetch = async (url, init) => {
		sent.push({ url: url instanceof Request ? url.url : url.toString(), init });
		return response;
	};
	return { sent, restore: () => (globalThis.fetch = original) };
}

test("a cloud transcription sends the key only to the provider, and returns its text", async () => {
	const stub = stubFetch(Response.json({ text: " Hello there. " }));
	try {
		assert.equal(await transcribeInCloud(modelsWithKey, "groq", RECORDING), "Hello there.");
		assert.equal(stub.sent[0]?.url, "https://api.groq.com/openai/v1/audio/transcriptions");
		assert.deepEqual(stub.sent[0]?.init?.headers, { Authorization: `Bearer ${KEY}` });
	} finally {
		stub.restore();
	}
});

test("a provider's error reply never reaches the learner, even when it repeats the key", async () => {
	const echo = JSON.stringify({ error: { message: `Incorrect API key provided: ${KEY}` } });
	const stub = stubFetch(new Response(echo, { status: 401 }));
	try {
		await assert.rejects(transcribeInCloud(modelsWithKey, "openai", RECORDING), (error) => {
			assert.ok(error instanceof VoiceError);
			assert.equal(error.message, "OpenAI rejected the key. Check it in Settings.");
			assert.ok(!error.message.includes(KEY));
			return true;
		});
	} finally {
		stub.restore();
	}
});

test("the transcribe route needs a chosen engine and a supported format", async () => {
	const app = createApp({ engine: createDemoEngine(), dataDir: await tempDir(), token: TOKEN });
	const transcribe = (type: string) =>
		app.request(`${BASE}/api/voice/transcribe`, {
			method: "POST",
			headers: { ...auth, "Content-Type": type },
			body: new Uint8Array([1, 2, 3]),
		});

	const off = await transcribe("audio/webm");
	assert.equal(off.status, 409);
	assert.match(((await off.json()) as { error: string }).error, /Settings/);
	assert.equal((await transcribe("text/html")).status, 415);

	await app.request(`${BASE}/api/preferences`, {
		method: "PUT",
		headers: { ...auth, "Content-Type": "application/json" },
		body: JSON.stringify({ voice: "fake-voice" }),
	});
	const done = await transcribe("audio/webm;codecs=opus");
	assert.equal(done.status, 200);
	assert.deepEqual(await done.json(), { text: "So the query is what the word is looking for." });
});
