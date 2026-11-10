import {
	fauxAssistantMessage,
	fauxToolCall,
	type FauxResponseFactory,
	type SystemMessage,
} from "@earendil-works/pi-ai";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { createScriptedEngine } from "../src/harness/fake-engine.ts";
import { FINISH_PROBE } from "../src/harness/prompts/finish-probe.ts";
import { readLog, type LogHeader } from "../src/harness/sessions/log.ts";
import { Session } from "../src/harness/sessions/session.ts";
import { FAKE_CHOICE, tempDir } from "./helpers.ts";

type Sent = { role: string; content?: unknown; sections?: Record<string, string> } & Partial<
	Pick<SystemMessage, "toolsAdded" | "toolsRemoved">
>;

/** A response step that records what would be sent to the model. */
function capture(into: Sent[][], reply: string): FauxResponseFactory {
	return (context) => {
		into.push(structuredClone(context.messages) as Sent[]);
		return fauxAssistantMessage(reply);
	};
}

const say = (session: Session, text: string) =>
	session.send({ text, attachmentIds: [] }, () => undefined, FAKE_CHOICE);

const logPath = (dir: string, id: string) => join(dir, "sessions", id, "session.jsonl");
const declares = (message: Sent | undefined, tool: string) =>
	message?.toolsAdded?.some((declared) => declared.name === tool) ?? false;
const sectionChanges = (messages: Sent[]) =>
	messages.slice(1).filter((message) => message.role === "system" && message.sections);

const OLD_ID = "22222222-2222-4222-8222-222222222222";
const OLD_LOG = `${[
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

test("an old single-prompt chat still replays with its own prompt and no probe", async () => {
	const dir = await tempDir();
	await mkdir(join(dir, "sessions", OLD_ID), { recursive: true });
	await writeFile(logPath(dir, OLD_ID), OLD_LOG);
	const seen: Sent[][] = [];
	const session = await Session.load(createScriptedEngine([capture(seen, "More.")]), dir, OLD_ID);
	await say(session, "And at sunset?");

	const [system, ...rest] = seen[0]!;
	assert.equal(system?.content, "Old prompt.");
	assert.equal(system?.sections, undefined);
	assert.ok(!declares(system, FINISH_PROBE), "an old chat isn't offered finish_probe");
	assert.deepEqual(sectionChanges(seen[0]!), []);
	const old = rest.filter((message) => message.role !== "system").slice(0, 2);
	assert.deepEqual(old, [
		{ role: "user", content: "Why is the sky blue?", timestamp: 1 },
		{ ...fauxAssistantMessage("Scattering."), timestamp: 2 },
	]);
	assert.ok((await readFile(logPath(dir, OLD_ID), "utf8")).startsWith(OLD_LOG));
});

test("the switch to the teacher survives a restart, and happens once", async () => {
	const dir = await tempDir();
	const probeEnds = fauxAssistantMessage(
		fauxToolCall(FINISH_PROBE, { goal: "Why attention needs keys and values", threads: [] }),
		{ stopReason: "toolUse" },
	);
	const first = new Session(createScriptedEngine([probeEnds, fauxAssistantMessage("Done.")]), dir);
	await say(first, "I want to understand attention");
	const { id } = first;
	const header = (await readLog(logPath(dir, id)))[0] as LogHeader;
	assert.equal(header.version, 2);
	assert.ok(header.phases?.prober && header.phases.teacher, "both phase prompts are saved");

	// After a restart, the first call is the teacher's.
	const seen: Sent[][] = [];
	const second = await Session.load(createScriptedEngine([capture(seen, "Plan.")]), dir, id);
	await say(second, "Go on");
	const [leading] = seen[0]!;
	assert.equal(leading?.sections?.phase, header.phases.prober);
	assert.ok(declares(leading, FINISH_PROBE));
	const [handover, ...more] = sectionChanges(seen[0]!);
	assert.deepEqual(more, []);
	assert.equal(handover?.sections?.phase, header.phases.teacher);
	assert.deepEqual(handover?.toolsRemoved, [{ name: FINISH_PROBE }]);

	// Another restart sends the same history, with no second switch.
	const third = await Session.load(createScriptedEngine([capture(seen, "Step one.")]), dir, id);
	await say(third, "Looks right");
	assert.deepEqual(seen[1]!.slice(0, seen[0]!.length), seen[0]);
	assert.equal(sectionChanges(seen[1]!).length, 1);
	const switches = (await readLog(logPath(dir, id))).filter(
		(entry) => entry.type === "tools" && entry.message.sections,
	);
	assert.equal(switches.length, 1);
});

test("a Practice chat keeps the single prompt and has no probe", async () => {
	const seen: Sent[][] = [];
	const session = new Session(createScriptedEngine([capture(seen, "Fine.")]), await tempDir());
	session.chooseType("practice");
	await say(session, "Quiz me");
	const [leading] = seen[0]!;
	assert.equal(leading?.sections, undefined);
	assert.ok(!declares(leading, FINISH_PROBE));
});
