import { fauxAssistantMessage, fauxText, fauxThinking, fauxToolCall } from "@earendil-works/pi-ai";
import type { FauxResponseFactory } from "@earendil-works/pi-ai";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { createScriptedEngine } from "../src/harness/fake-engine.ts";
import { Session } from "../src/harness/sessions/session.ts";
import type { RunEvent } from "../src/shared/protocol.ts";
import { FAKE_CHOICE, tempDir } from "./helpers.ts";

const usage = {
	input: 10,
	output: 5,
	cacheRead: 0,
	cacheWrite: 0,
	totalTokens: 15,
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

/** A chat saved before Activity existed: signed and redacted reasoning, a tool, and no `workedMs`. */
const OLD_REPLY = {
	api: "anthropic-messages",
	provider: "anthropic",
	model: "claude-old",
	usage,
};
const OLD_LOG = [
	{ type: "header", version: 1, id: "old", createdAt: 1000, systemPrompt: "Saved prompt." },
	{
		type: "message",
		message: { role: "user", content: [{ type: "text", text: "Why?" }], timestamp: 1000 },
		display: { text: "Why?", attachmentIds: [] },
	},
	{
		type: "message",
		message: {
			...OLD_REPLY,
			role: "assistant",
			content: [
				{ type: "thinking", thinking: "Saved reasoning.", thinkingSignature: "sig-1" },
				{ type: "thinking", thinking: "", thinkingSignature: "secret", redacted: true },
				{ type: "toolCall", id: "call-1", name: "read_attachment", arguments: { id: "gone" } },
			],
			stopReason: "toolUse",
			timestamp: 2000,
		},
	},
	{
		type: "message",
		message: {
			role: "toolResult",
			toolCallId: "call-1",
			toolName: "read_attachment",
			content: [{ type: "text", text: "Saved result." }],
			isError: false,
			durationMs: 800,
			timestamp: 3000,
		},
	},
	{
		type: "message",
		message: {
			...OLD_REPLY,
			role: "assistant",
			content: [{ type: "text", text: "Saved answer.", textSignature: "sig-2" }],
			stopReason: "stop",
			timestamp: 5000,
		},
	},
];

const OLD_TEXT = `${OLD_LOG.map((entry) => JSON.stringify(entry)).join("\n")}\n`;

async function writeOldLog(dir: string): Promise<string> {
	const folder = join(dir, "sessions", "old");
	await mkdir(folder, { recursive: true });
	const path = join(folder, "session.jsonl");
	await writeFile(path, OLD_TEXT);
	return path;
}

test("an old chat replays byte-identically, and reopening it doesn't touch the log", async () => {
	const dir = await tempDir();
	const path = await writeOldLog(dir);
	const seen: { messages: unknown[] }[] = [];
	const capture: FauxResponseFactory = (context) => {
		seen.push(structuredClone({ messages: context.messages }));
		return fauxAssistantMessage("New.");
	};
	const session = await Session.load(createScriptedEngine([capture]), dir, "old");
	session.view();
	assert.equal(await readFile(path, "utf8"), OLD_TEXT);

	await session.send({ text: "More", attachmentIds: [] }, () => undefined, FAKE_CHOICE);
	const log = await readFile(path, "utf8");
	assert.ok(log.startsWith(OLD_TEXT), "new records only ever go after the old ones");

	// Compare everything the model is sent for the old turns, including the system prompt.
	const [system, ...sent] = seen[0]!.messages as { role: string; content: unknown }[];
	assert.equal(system?.role, "system");
	assert.equal(system?.content, "Saved prompt.");
	const saved = OLD_LOG.slice(1).map((entry) => (entry as { message: unknown }).message);
	assert.equal(JSON.stringify(sent.slice(0, saved.length)), JSON.stringify(saved));
	assert.equal(sent.length, saved.length + 1);
});

test("an old chat shows its reasoning and tools, with an estimated time", async () => {
	const dir = await tempDir();
	await writeOldLog(dir);
	const session = await Session.load(createScriptedEngine([]), dir, "old");
	const reply = session.view().messages.at(-1)!;
	assert.deepEqual(reply.blocks, [
		{ kind: "reasoning", text: "Saved reasoning." },
		{ kind: "tool", id: "call-1", label: "Read attachment", state: "done", durationMs: 800 },
		{ kind: "text", text: "Saved answer." },
	]);
	assert.equal(reply.workedMs, 4000);
});

test("a new reply streams its reasoning, and reopening shows the same time and trace", async () => {
	const dir = await tempDir();
	const engine = createScriptedEngine([]);
	const session = new Session(engine, dir);
	const notes = await session.attachments.add("notes.txt", new TextEncoder().encode("facts"));
	engine.faux.setResponses([
		fauxAssistantMessage(
			[fauxThinking("Reading first."), fauxToolCall("read_attachment", { id: notes.id })],
			{ stopReason: "toolUse" },
		),
		fauxAssistantMessage([fauxThinking("Now answering."), fauxText("Answer.")]),
	]);
	const events: RunEvent[] = [];
	await session.send({ text: "Go", attachmentIds: [] }, (e) => events.push(e), FAKE_CHOICE);

	const order = events.map((event) => event.type).filter((type, i, all) => type !== all[i - 1]);
	assert.deepEqual(order, [
		"reasoning_delta",
		"tool_start",
		"tool_end",
		"reasoning_delta",
		"reply_start",
		"text_delta",
		"done",
	]);
	const start = events.find((event) => event.type === "tool_start");
	assert.ok(start?.type === "tool_start");
	assert.equal(start.runningLabel, "Reading notes.txt");
	const end = events.find((event) => event.type === "tool_end");
	assert.ok(end?.type === "tool_end" && typeof end.durationMs === "number");
	const replyStart = events.find((event) => event.type === "reply_start");
	assert.ok(replyStart?.type === "reply_start");

	const reloaded = await Session.load(createScriptedEngine([]), dir, session.id);
	const reply = reloaded.view().messages.at(-1)!;
	assert.equal(reply.workedMs, replyStart.workedMs);
	assert.deepEqual(
		reply.blocks.map((block) =>
			block.kind === "tool" ? block.label : "text" in block ? block.text : block.kind,
		),
		["Reading first.", "Read notes.txt", "Now answering.", "Answer."],
	);

	// The timing is saved beside the reply, so what the model is sent is untouched.
	const lines = (await readFile(join(dir, "sessions", session.id, "session.jsonl"), "utf8"))
		.split("\n")
		.filter(Boolean)
		.map((line) => JSON.parse(line) as { workedMs?: number; message?: { role: string } });
	const withTime = lines.filter((line) => line.workedMs !== undefined);
	assert.equal(withTime.length, 1);
	assert.equal(withTime[0]?.message?.role, "assistant");
	assert.equal("workedMs" in (withTime[0]?.message ?? {}), false);
});

test("a tool settled by crash recovery doesn't stretch the estimated time", async () => {
	const dir = await tempDir();
	const path = await writeOldLog(dir);
	await writeFile(path, `${OLD_TEXT.split("\n").slice(0, 3).join("\n")}\n`);
	const session = await Session.load(createScriptedEngine([]), dir, "old");
	const reply = session.view().messages.at(-1)!;
	assert.equal(reply.workedMs, 1000);
});
