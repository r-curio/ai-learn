import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { builtinModels } from "@earendil-works/pi-ai/providers/all";
import { createEngine } from "../src/harness/engine.ts";
import { ProviderKeyStore, type KeyCipher } from "../src/harness/provider-keys.ts";
import { createApp } from "../src/server/app.ts";
import type { EngineStatus } from "../src/shared/protocol.ts";
import { tempDir } from "./helpers.ts";

const TOKEN = "test-token";
const BASE = "http://127.0.0.1:1234";
const auth = { Authorization: `Bearer ${TOKEN}`, Host: "127.0.0.1:1234" };
const json = { ...auth, "Content-Type": "application/json" };
const SECRET = "sk-test-do-not-leak-1234567890";
const FILE = "provider-keys.json";

/** Real encryption with a key of its own, standing in for the system keychain. */
function testCipher(unavailable?: string): KeyCipher {
	const key = randomBytes(32);
	return {
		unavailableReason: () => unavailable,
		encrypt(text) {
			const iv = randomBytes(12);
			const cipher = createCipheriv("aes-256-gcm", key, iv);
			const body = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
			return Buffer.concat([iv, cipher.getAuthTag(), body]);
		},
		decrypt(data) {
			const decipher = createDecipheriv("aes-256-gcm", key, data.subarray(0, 12));
			decipher.setAuthTag(data.subarray(12, 28));
			return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8");
		},
	};
}

/** No environment keys unless a test gives some, so the developer's own never interfere. */
const envOf = (values: Record<string, string> = {}) => ({
	env: (name: string) => Promise.resolve(values[name]),
	fileExists: () => Promise.resolve(false),
});

function appFor(dataDir: string, cipher?: KeyCipher, env?: Record<string, string>) {
	const engine = createEngine({ dataDir, cipher, authContext: envOf(env) });
	return { engine, app: createApp({ engine, dataDir, token: TOKEN }) };
}

type App = ReturnType<typeof appFor>["app"];
const saveKey = (app: App, id: string, key: string, headers: Record<string, string> = json) =>
	app.request(`${BASE}/api/providers/${id}/key`, {
		method: "PUT",
		headers,
		body: JSON.stringify({ key }),
	});
const statusOf = async (app: App) =>
	(await (await app.request(`${BASE}/api/status`, { headers: auth })).json()) as EngineStatus;
const HAIKU = { provider: "anthropic", id: "claude-haiku-5-5", effort: "low" } as const;

test("a saved key is encrypted on disk, survives a restart, and is never sent back", async () => {
	const dataDir = await tempDir();
	const cipher = testCipher();
	const { app, engine } = appFor(dataDir, cipher);
	assert.equal((await statusOf(app)).ready, false);
	assert.equal(await engine.resolve(HAIKU), undefined);

	const saved = await saveKey(app, "anthropic", SECRET);
	assert.equal(saved.status, 200);
	assert.ok(!(await saved.text()).includes(SECRET));

	const onDisk = await readFile(join(dataDir, FILE), "utf8");
	assert.ok(!onDisk.includes(SECRET));
	assert.ok(!onDisk.includes(Buffer.from(SECRET).toString("base64")));
	if (process.platform !== "win32")
		assert.equal((await stat(join(dataDir, FILE))).mode & 0o777, 0o600);
	assert.ok(!(await readdir(dataDir)).some((name) => name.endsWith(".tmp")));

	const status = await statusOf(app);
	assert.equal(status.ready, true);
	assert.ok(!JSON.stringify(status).includes(SECRET));
	assert.equal(status.providers.find(({ id }) => id === "anthropic")?.keySource, "saved");
	assert.ok(!status.addable.some(({ id }) => id === "anthropic"));

	// A new engine over the same folder is a restart.
	const restarted = appFor(dataDir, cipher);
	assert.equal((await statusOf(restarted.app)).ready, true);
	assert.ok(await restarted.engine.resolve(HAIKU));
});

test("removing a saved key disconnects the provider and takes it off disk", async () => {
	const dataDir = await tempDir();
	const { app, engine } = appFor(dataDir, testCipher());
	await saveKey(app, "anthropic", SECRET);
	await saveKey(app, "openai", `${SECRET}-other`);
	const before = await readFile(join(dataDir, FILE), "utf8");

	const removed = await app.request(`${BASE}/api/providers/anthropic/key`, {
		method: "DELETE",
		headers: auth,
	});
	assert.equal(removed.status, 200);
	const after = await readFile(join(dataDir, FILE), "utf8");
	assert.notEqual(before, after);
	assert.ok(!after.includes('"anthropic"'));
	assert.ok(after.includes('"openai"'));
	assert.equal(await engine.resolve(HAIKU), undefined);
	assert.deepEqual(
		(await statusOf(app)).providers.map(({ id }) => id),
		["openai"],
	);
});

test("an environment key wins over a saved one, and can't be replaced in the app", async () => {
	const dataDir = await tempDir();
	const cipher = testCipher();
	await saveKey(appFor(dataDir, cipher).app, "anthropic", SECRET);

	// Ask Pi directly which key a request would really use.
	const keyInUse = async (values: Record<string, string>) => {
		const authContext = envOf(values);
		const environment = builtinModels({ authContext });
		const credentials = new ProviderKeyStore(
			dataDir,
			cipher,
			async (id) => (await environment.getAuth(id)) !== undefined,
		);
		return (await builtinModels({ authContext, credentials }).getAuth("anthropic"))?.auth.apiKey;
	};
	assert.equal(await keyInUse({}), SECRET);
	assert.equal(await keyInUse({ ANTHROPIC_API_KEY: "sk-from-env" }), "sk-from-env");

	const { app } = appFor(dataDir, cipher, { ANTHROPIC_API_KEY: "sk-from-env" });
	const status = await statusOf(app);
	assert.equal(status.providers.find(({ id }) => id === "anthropic")?.keySource, "environment");
	assert.equal((await saveKey(app, "anthropic", "sk-new")).status, 409);
});

test("providers that need more than a key aren't offered, and their keys are refused", async () => {
	const dataDir = await tempDir();
	const { app } = appFor(dataDir, testCipher());
	const { addable } = await statusOf(app);
	assert.ok(addable.some(({ id }) => id === "openai"));
	for (const id of ["azure", "amazon-bedrock", "cloudflare-ai-gateway", "cloudflare-workers-ai"]) {
		assert.ok(!addable.some((provider) => provider.id === id));
		assert.equal((await saveKey(app, id, SECRET)).status, 400);
	}
	assert.ok(!(await readdir(dataDir)).includes(FILE));
});

test("every provider offered connects once it has a key", async () => {
	const dataDir = await tempDir();
	const { app } = appFor(dataDir, testCipher());
	const offered = (await statusOf(app)).addable.map(({ id }) => id);
	assert.ok(offered.length > 0);
	for (const id of offered) assert.equal((await saveKey(app, id, SECRET)).status, 200);
	const after = await statusOf(app);
	assert.deepEqual(after.addable, []);
	assert.deepEqual(after.providers.map(({ id }) => id).sort(), [...offered].sort());
});

test("keys are refused, with a reason, when real encryption isn't available", async () => {
	for (const cipher of [undefined, testCipher("No keychain here.")]) {
		const dataDir = await tempDir();
		const { app } = appFor(dataDir, cipher);
		const response = await saveKey(app, "anthropic", SECRET);
		assert.equal(response.status, 503);
		assert.ok(((await response.json()) as { error: string }).error.length > 0);
		assert.ok((await statusOf(app)).keysUnavailable);
		assert.ok(!(await readdir(dataDir)).includes(FILE));
	}
});

test("a key that can't be decrypted, or a damaged file, means not connected", async () => {
	const dataDir = await tempDir();
	await saveKey(appFor(dataDir, testCipher()).app, "anthropic", SECRET);

	// A different cipher is the same as a data folder copied to another computer.
	const copied = appFor(dataDir, testCipher());
	assert.equal((await statusOf(copied.app)).ready, false);
	assert.equal(await copied.engine.resolve(HAIKU), undefined);

	await writeFile(join(dataDir, FILE), "not json");
	assert.equal((await statusOf(appFor(dataDir, testCipher()).app)).ready, false);
});

test("key requests need the token, a real provider, and a clean key", async () => {
	const dataDir = await tempDir();
	const { app } = appFor(dataDir, testCipher());
	assert.equal(
		(
			await saveKey(app, "anthropic", SECRET, {
				Host: auth.Host,
				"Content-Type": "application/json",
			})
		).status,
		401,
	);
	assert.equal((await saveKey(app, "no-such-provider", SECRET)).status, 400);
	for (const bad of ["", "two words", "line\nbreak", "x".repeat(5000)]) {
		const response = await saveKey(app, "anthropic", bad);
		assert.equal(response.status, 400);
		assert.ok(!(await response.text()).includes(bad || "\0"));
	}
	assert.ok(!(await readdir(dataDir)).includes(FILE));
});

test("a voice-only key is saved, removed, and never sent back, and the environment wins", async () => {
	const dataDir = await tempDir();
	const { app } = appFor(dataDir, testCipher());
	const deepgram = async (target: App) =>
		(await statusOf(target)).voice.find(({ id }) => id === "deepgram");
	assert.deepEqual(await deepgram(app), {
		id: "deepgram",
		label: "Deepgram",
		connected: false,
		ownKey: true,
	});

	assert.equal((await saveKey(app, "deepgram", SECRET)).status, 200);
	const status = await app.request(`${BASE}/api/status`, { headers: auth });
	const body = await status.text();
	assert.ok(!body.includes(SECRET));
	assert.equal((await deepgram(app))?.keySource, "saved");
	assert.ok(!(await readFile(join(dataDir, FILE), "utf8")).includes(SECRET));
	// Deepgram has no chat models, so it never turns up as a chat provider.
	assert.ok(!(await statusOf(app)).providers.some(({ id }) => id === "deepgram"));

	await app.request(`${BASE}/api/providers/deepgram/key`, { method: "DELETE", headers: auth });
	assert.equal((await deepgram(app))?.connected, false);

	const fromEnv = appFor(await tempDir(), testCipher(), { DEEPGRAM_API_KEY: "dg-from-env" }).app;
	assert.equal((await deepgram(fromEnv))?.keySource, "environment");
	assert.equal((await saveKey(fromEnv, "deepgram", SECRET)).status, 409);
});

test("a search key is saved, removed, and never sent back, and the environment wins", async () => {
	const dataDir = await tempDir();
	const { app } = appFor(dataDir, testCipher());
	const tavily = async (target: App) =>
		(await statusOf(target)).search.find(({ id }) => id === "tavily");
	assert.deepEqual(await tavily(app), { id: "tavily", label: "Tavily", connected: false });

	assert.equal((await saveKey(app, "tavily", SECRET)).status, 200);
	const body = await (await app.request(`${BASE}/api/status`, { headers: auth })).text();
	assert.ok(!body.includes(SECRET));
	assert.equal((await tavily(app))?.keySource, "saved");
	assert.ok(!(await readFile(join(dataDir, FILE), "utf8")).includes(SECRET));

	await app.request(`${BASE}/api/providers/tavily/key`, { method: "DELETE", headers: auth });
	assert.equal((await tavily(app))?.connected, false);

	const fromEnv = appFor(await tempDir(), testCipher(), { TAVILY_API_KEY: "tvly-from-env" }).app;
	assert.equal((await tavily(fromEnv))?.keySource, "environment");
	assert.equal((await saveKey(fromEnv, "tavily", SECRET)).status, 409);
});
