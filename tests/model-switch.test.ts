import {
	fauxAssistantMessage,
	fauxThinking,
	type FauxResponseFactory,
	type Message,
} from "@earendil-works/pi-ai";
import { transformMessages } from "@earendil-works/pi-ai/api/transform-messages";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { createScriptedEngine } from "../src/harness/fake-engine.ts";
import { Session } from "../src/harness/sessions/session.ts";
import { createApp } from "../src/server/app.ts";
import type {
	EngineStatus,
	ModelSelection,
	Preferences,
	SessionView,
} from "../src/shared/protocol.ts";
import { tempDir } from "./helpers.ts";

const TOKEN = "test-token";
const BASE = "http://127.0.0.1:1234";
const auth = { Authorization: `Bearer ${TOKEN}`, Host: "127.0.0.1:1234" };
const json = { ...auth, "Content-Type": "application/json" };

/** Replies with thinking, and notes which model and level each request used. */
function recordingEngine() {
	const calls: { model: string; level?: string; messages: Message[]; api: string }[] = [];
	const reply: FauxResponseFactory = (context, options, _state, model) => {
		calls.push({
			model: model.id,
			level: options?.reasoning,
			messages: transformMessages(context.messages, model),
			api: model.api,
		});
		return fauxAssistantMessage([
			fauxThinking(`thought by ${model.id}`),
			{ type: "text", text: "Ok" },
		]);
	};
	const engine = createScriptedEngine(Array.from({ length: 8 }, () => reply));
	return { engine, calls };
}

const thinkingIn = (messages: Message[]) =>
	messages.flatMap((message) =>
		message.role === "assistant"
			? message.content.flatMap((block) => (block.type === "thinking" ? [block.thinking] : []))
			: [],
	);

async function choose({ engine }: ReturnType<typeof recordingEngine>, selection: ModelSelection) {
	const choice = await engine.resolve(selection);
	assert.ok(choice);
	return choice;
}

test("switching models keeps saved history intact and survives reopening", async () => {
	const recording = recordingEngine();
	const { engine, calls } = recording;
	const dir = await tempDir();
	const session = new Session(engine, dir);
	const say = async (target: Session, text: string, selection: ModelSelection) =>
		target.send({ text, attachmentIds: [] }, () => {}, await choose(recording, selection));
	const first = { provider: "faux", id: "fake-model", effort: "medium" } as const;
	const deep = { provider: "faux", id: "fake-model-deep", effort: "max" } as const;

	await say(session, "One", first);
	await say(session, "Two", deep);
	const log = join(dir, "sessions", session.id, "session.jsonl");
	const before = await readFile(log, "utf8");

	const reopened = await Session.load(engine, dir, session.id);
	assert.equal(reopened.view().messages.length, 4);
	await say(reopened, "Three", first);
	await say(reopened, "Four", deep);

	// Saved lines never change, and each reply still names the model that wrote it.
	const after = await readFile(log, "utf8");
	assert.ok(after.startsWith(before));
	const saved = after
		.trim()
		.split("\n")
		.map((line) => JSON.parse(line) as { message?: { role: string; model?: string } })
		.flatMap(({ message }) => (message?.role === "assistant" ? [message.model] : []));
	assert.deepEqual(saved, ["fake-model", "fake-model-deep", "fake-model", "fake-model-deep"]);

	// The right model and level ran each turn, and a model only sees its own reasoning.
	assert.deepEqual(
		calls.map(({ model, level }) => [model, level]),
		[
			["fake-model", "medium"],
			["fake-model-deep", "max"],
			["fake-model", "medium"],
			["fake-model-deep", "max"],
		],
	);
	assert.deepEqual(thinkingIn(calls[1]!.messages), []);
	assert.deepEqual(thinkingIn(calls[2]!.messages), ["thought by fake-model"]);
	assert.deepEqual(thinkingIn(calls[3]!.messages), ["thought by fake-model-deep"]);
});

test("the server lists options, and refuses a model or effort that can't be used", async () => {
	const { engine, calls } = recordingEngine();
	const app = createApp({ engine, dataDir: await tempDir(), token: TOKEN });
	const status = (await (
		await app.request(`${BASE}/api/status`, { headers: auth })
	).json()) as EngineStatus;
	assert.equal(status.ready, true);
	const models = status.providers.flatMap((provider) => provider.models);
	assert.deepEqual(models.find(({ id }) => id === "fake-model-deep")?.efforts, ["xhigh", "max"]);
	const provider = "faux";

	const { id } = (await (
		await app.request(`${BASE}/api/sessions`, { method: "POST", headers: auth })
	).json()) as { id: string };
	const send = (model: ModelSelection) =>
		app.request(`${BASE}/api/sessions/${id}/messages`, {
			method: "POST",
			headers: json,
			body: JSON.stringify({ text: "Hi", model }),
		});
	assert.equal((await send({ provider, id: "no-such-model", effort: "low" })).status, 400);
	assert.equal((await send({ provider: "nobody", id: "fake-model", effort: "low" })).status, 400);
	// This model has no Medium, and a stale menu shouldn't be able to ask for it.
	assert.equal((await send({ provider, id: "fake-model-deep", effort: "medium" })).status, 400);
	// Nothing is chosen for the learner, so a message without a model is refused and not saved.
	const unchosen = await app.request(`${BASE}/api/sessions/${id}/messages`, {
		method: "POST",
		headers: json,
		body: JSON.stringify({ text: "Hi" }),
	});
	assert.equal(unchosen.status, 400);
	const view = (await (
		await app.request(`${BASE}/api/sessions/${id}`, { headers: auth })
	).json()) as SessionView;
	assert.equal(view.messages.length, 0);
	assert.equal(calls.length, 0);

	const accepted = await send({ provider, id: "fake-model-deep", effort: "xhigh" });
	assert.equal(accepted.status, 200);
	await accepted.text();
	assert.deepEqual(
		calls.map(({ model, level }) => [model, level]),
		[["fake-model-deep", "xhigh"]],
	);
});

test("retrying can move a failed reply onto another model", async () => {
	const seen: string[] = [];
	const engine = createScriptedEngine([
		fauxAssistantMessage("", { stopReason: "error", errorMessage: "Overloaded" }),
		(_context, _options, _state, model) => {
			seen.push(model.id);
			return fauxAssistantMessage("Better");
		},
	]);
	const app = createApp({ engine, dataDir: await tempDir(), token: TOKEN });
	const { id } = (await (
		await app.request(`${BASE}/api/sessions`, { method: "POST", headers: auth })
	).json()) as { id: string };
	await (
		await app.request(`${BASE}/api/sessions/${id}/messages`, {
			method: "POST",
			headers: json,
			body: JSON.stringify({
				text: "Hi",
				model: { provider: "faux", id: "fake-model", effort: "low" },
			}),
		})
	).text();
	const model = { provider: "faux", id: "fake-model-deep", effort: "max" };
	const unchosen = await app.request(`${BASE}/api/sessions/${id}/retry`, {
		method: "POST",
		headers: json,
		body: "{}",
	});
	assert.equal(unchosen.status, 400);
	const retry = await app.request(`${BASE}/api/sessions/${id}/retry`, {
		method: "POST",
		headers: json,
		body: JSON.stringify({ model }),
	});
	assert.equal(retry.status, 200);
	await retry.text();
	assert.deepEqual(seen, ["fake-model-deep"]);
});

test("saving one preference keeps the others, and old files still load", async () => {
	const dataDir = await tempDir();
	const { engine } = recordingEngine();
	const app = createApp({ engine, dataDir, token: TOKEN });
	await writeFile(join(dataDir, "preferences.json"), JSON.stringify({ sidebarOpen: false }));
	const put = (body: Partial<Preferences>) =>
		app.request(`${BASE}/api/preferences`, {
			method: "PUT",
			headers: json,
			body: JSON.stringify(body),
		});
	await put({ model: { provider: "anthropic", id: "claude-haiku-5-5" } });
	await put({ effort: "high" });
	const saved: unknown = await (
		await app.request(`${BASE}/api/preferences`, { headers: auth })
	).json();
	assert.deepEqual(saved, {
		sidebarOpen: false,
		model: { provider: "anthropic", id: "claude-haiku-5-5" },
		effort: "high",
	});
});
