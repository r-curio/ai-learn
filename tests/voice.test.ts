import type { Models } from "@earendil-works/pi-ai";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createDemoEngine } from "../src/harness/fake-engine.ts";
import { cloudVoiceModels, transcribeInCloud } from "../src/harness/voice/openai-compatible.ts";
import { transcribeWithDeepgram } from "../src/harness/voice/deepgram.ts";
import { transcribeWithNvidia } from "../src/harness/voice/nvidia.ts";
import { VoiceError } from "../src/harness/voice/voice-error.ts";
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

test("a chosen model reaches the provider, and a missing one gets a safe message", async () => {
	const stub = stubFetch(Response.json({ text: "Hi." }));
	try {
		await transcribeInCloud(modelsWithKey, "groq", RECORDING, "whisper-large-v3");
		assert.equal((stub.sent[0]?.init?.body as FormData).get("model"), "whisper-large-v3");
	} finally {
		stub.restore();
	}
	const missing = stubFetch(new Response("{}", { status: 404 }));
	try {
		await assert.rejects(transcribeInCloud(modelsWithKey, "groq", RECORDING, "gone"), {
			message: "That model isn't available from Groq. Choose another in Settings.",
		});
	} finally {
		missing.restore();
	}
});

test("only speech models are offered, with the default first", async () => {
	const stub = stubFetch(
		Response.json({
			data: [
				{ id: "gpt-5" },
				{ id: "whisper-1" },
				{ id: "gpt-4o-transcribe" },
				{ id: "gpt-4o-realtime-preview" },
				{ id: "gpt-4o-transcribe-diarize" },
				{ id: "gpt-4o-mini-transcribe" },
			],
		}),
	);
	try {
		assert.deepEqual(await cloudVoiceModels(modelsWithKey, "openai"), {
			models: ["gpt-4o-mini-transcribe", "gpt-4o-transcribe", "whisper-1"],
			defaultModel: "gpt-4o-mini-transcribe",
		});
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

test("Deepgram gets the raw recording with its own key header, and its text comes back", async () => {
	const reply = {
		results: { channels: [{ alternatives: [{ transcript: " Hello, Deepgram. " }] }] },
	};
	const stub = stubFetch(Response.json(reply));
	try {
		assert.equal(await transcribeWithDeepgram(KEY, RECORDING), "Hello, Deepgram.");
		assert.equal(
			stub.sent[0]?.url,
			"https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true",
		);
		assert.deepEqual(stub.sent[0]?.init?.headers, {
			"Content-Type": "audio/webm",
			Authorization: `Token ${KEY}`,
		});
	} finally {
		stub.restore();
	}
	const echo = JSON.stringify({ err_code: "INVALID_AUTH", err_msg: `Invalid credentials: ${KEY}` });
	const rejected = stubFetch(new Response(echo, { status: 401 }));
	try {
		await assert.rejects(transcribeWithDeepgram(KEY, RECORDING), {
			message: "Deepgram rejected the key. Check it in Settings.",
		});
	} finally {
		rejected.restore();
	}
});

test("the transcribe route needs a chosen engine and a supported format, and Off sticks", async () => {
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

	const choose = (change: { voice?: string | null; voiceModel?: string | null }) =>
		app.request(`${BASE}/api/preferences`, {
			method: "PUT",
			headers: { ...auth, "Content-Type": "application/json" },
			body: JSON.stringify(change),
		});
	await choose({ voice: "fake-voice", voiceModel: "fake-speech-accurate" });
	const done = await transcribe("audio/webm;codecs=opus");
	assert.equal(done.status, 200);
	assert.deepEqual(await done.json(), { text: "So the query is what the word is looking for." });

	// Turning voice off has to stick, or recordings keep going to the old engine.
	const saved = (await (await choose({ voice: null, voiceModel: null })).json()) as object;
	assert.deepEqual(saved, { sidebarOpen: true });
	assert.equal((await transcribe("audio/webm")).status, 409);
});

const NVIDIA_KEY = "nvapi-test-secret-key";
const WAV = { audio: new Uint8Array([1, 2, 3]), mimeType: "audio/wav" };
const FUNCTION_ID = "1598d209-5e27-4d3c-8079-4751568b1081";
const modelsWithNvidiaKey = {
	getAuth: async () => ({ auth: { apiKey: NVIDIA_KEY } }),
} as unknown as Models;

const functionList = (status = "ACTIVE") =>
	Response.json({ functions: [{ id: FUNCTION_ID, name: "ai-parakeet-ctc-1_1b-asr", status }] });

/** Replace `fetch` with replies given in order, recording what was sent. */
function stubReplies(...replies: Response[]) {
	const sent: { url: string; init?: RequestInit }[] = [];
	const original = globalThis.fetch;
	globalThis.fetch = async (url, init) => {
		sent.push({ url: url instanceof Request ? url.url : url.toString(), init });
		return replies.shift() ?? new Response(null, { status: 500 });
	};
	return { sent, restore: () => (globalThis.fetch = original) };
}

test("NVIDIA gets a WAV with the looked-up function ID and the key, and its text comes back", async () => {
	const stub = stubReplies(functionList(), Response.json({ text: " Hello, Parakeet. " }));
	try {
		assert.equal(await transcribeWithNvidia(modelsWithNvidiaKey, WAV), "Hello, Parakeet.");
		assert.equal(stub.sent[0]?.url, "https://api.nvcf.nvidia.com/v2/nvcf/functions");
		assert.equal(stub.sent[1]?.url, "https://grpc.nvcf.nvidia.com/v1/audio/transcriptions");
		assert.deepEqual(stub.sent[1]?.init?.headers, {
			"function-id": FUNCTION_ID,
			Authorization: `Bearer ${NVIDIA_KEY}`,
		});
		assert.equal((stub.sent[1]?.init?.body as FormData).get("language"), "en-US");
	} finally {
		stub.restore();
	}
});

test("a stale function ID shows a safe message, and the next try looks the ID up again", async () => {
	const stub = stubReplies(
		new Response("Function not found for account", { status: 404 }),
		functionList(),
		Response.json({ text: "Back again." }),
	);
	try {
		// The ID cached by the first test is now stale.
		await assert.rejects(transcribeWithNvidia(modelsWithNvidiaKey, WAV), {
			message: "This model isn't available from NVIDIA right now.",
		});
		assert.equal(await transcribeWithNvidia(modelsWithNvidiaKey, WAV), "Back again.");
		assert.equal(stub.sent[1]?.url, "https://api.nvcf.nvidia.com/v2/nvcf/functions");
	} finally {
		stub.restore();
	}
});

test("a model NVIDIA no longer lists, or a recording that isn't WAV, gets a safe message", async () => {
	await assert.rejects(transcribeWithNvidia(modelsWithNvidiaKey, WAV, "parakeet-tdt-0.6b-v2"), {
		message: "This model isn't available from NVIDIA right now.",
	});
	await assert.rejects(
		transcribeWithNvidia(modelsWithNvidiaKey, { ...WAV, mimeType: "audio/webm" }),
		{
			message: "NVIDIA needs the recording as WAV. Reload the app and try again.",
		},
	);
});

test("NVIDIA's rejection never reaches the learner, even when it repeats the key", async () => {
	const echo = `rpc error: code = PermissionDenied desc = Authorization failed for ${NVIDIA_KEY}`;
	const stub = stubReplies(new Response(echo, { status: 403 }));
	try {
		await assert.rejects(transcribeWithNvidia(modelsWithNvidiaKey, WAV), (error: Error) => {
			assert.equal(error.message, "NVIDIA rejected the key. Check it in Settings.");
			return true;
		});
	} finally {
		stub.restore();
	}
});
