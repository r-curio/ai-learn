import {
	fauxAssistantMessage,
	fauxToolCall,
	type FauxResponseFactory,
} from "@earendil-works/pi-ai";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createScriptedEngine } from "../src/harness/fake-engine.ts";
import { Session, SessionBusyError } from "../src/harness/session.ts";
import type { RunEvent } from "../src/shared/protocol.ts";
import { PNG, tempDir } from "./helpers.ts";

async function run(
	session: Session,
	text: string,
	attachmentIds: string[] = [],
): Promise<RunEvent[]> {
	const events: RunEvent[] = [];
	await session.send({ text, attachmentIds }, (event) => events.push(event));
	return events;
}

const streamed = (events: RunEvent[]) =>
	events.flatMap((event) => (event.type === "text_delta" ? [event.delta] : [])).join("");

test("text streams in pieces and the run reports done", async () => {
	const engine = createScriptedEngine([
		fauxAssistantMessage("Photosynthesis turns light into sugar."),
	]);
	const events = await run(new Session(engine, await tempDir()), "Explain photosynthesis");
	assert.equal(streamed(events), "Photosynthesis turns light into sugar.");
	assert.ok(events.filter((event) => event.type === "text_delta").length > 1);
	const done = events.at(-1);
	assert.ok(done?.type === "done" && done.stopReason === "stop");
});

test("the model can call a tool, then continue with its result", async () => {
	let toolResult = "";
	const afterTool: FauxResponseFactory = (context) => {
		const last = context.messages.at(-1);
		if (last?.role === "toolResult") toolResult = JSON.stringify(last.content);
		return fauxAssistantMessage("The notes mention enzymes.");
	};
	const engine = createScriptedEngine([]);
	const live = new Session(engine, await tempDir());
	const stored = await live.attachments.add(
		"notes.txt",
		new TextEncoder().encode("enzymes speed reactions"),
	);
	engine.faux.setResponses([
		fauxAssistantMessage(fauxToolCall("read_attachment", { id: stored.id }), {
			stopReason: "toolUse",
		}),
		afterTool,
	]);

	const events = await run(live, "What do my notes say?");
	const start = events.find((event) => event.type === "tool_start");
	assert.ok(start?.type === "tool_start" && start.name === "read_attachment");
	const end = events.find((event) => event.type === "tool_end");
	assert.ok(end?.type === "tool_end" && !end.isError);
	assert.match(toolResult, /enzymes speed reactions/);
	assert.equal(streamed(events), "The notes mention enzymes.");
});

test("a failing tool is reported and the model can recover", async () => {
	const engine = createScriptedEngine([
		fauxAssistantMessage(fauxToolCall("read_attachment", { id: "missing" }), {
			stopReason: "toolUse",
		}),
		fauxAssistantMessage("I couldn't read that."),
	]);
	const events = await run(new Session(engine, await tempDir()), "Read it");
	const end = events.find((event) => event.type === "tool_end");
	assert.ok(end?.type === "tool_end" && end.isError);
	assert.equal(streamed(events), "I couldn't read that.");
});

test("uploaded images reach the model as images", async () => {
	let imageParts = 0;
	const inspect: FauxResponseFactory = (context) => {
		const last = context.messages.at(-1);
		if (last?.role === "user" && Array.isArray(last.content))
			imageParts = last.content.filter((part) => part.type === "image").length;
		return fauxAssistantMessage("I see it.");
	};
	const session = new Session(createScriptedEngine([inspect]), await tempDir());
	const info = await session.attachments.add("diagram.png", PNG);
	await run(session, "What is this?", [info.id]);
	assert.equal(imageParts, 1);
});

test("conversation history carries into the next turn", async () => {
	let seen = 0;
	const engine = createScriptedEngine([
		fauxAssistantMessage("First."),
		(context) => {
			seen = context.messages.filter((message) => message.role !== "system").length;
			return fauxAssistantMessage("Second.");
		},
	]);
	const session = new Session(engine, await tempDir());
	await run(session, "One");
	await run(session, "Two");
	assert.equal(seen, 3);
});

test("a provider error surfaces instead of looking like an empty reply", async () => {
	const engine = createScriptedEngine([
		fauxAssistantMessage("", { stopReason: "error", errorMessage: "Rate limited" }),
	]);
	const done = (await run(new Session(engine, await tempDir()), "Hi")).at(-1);
	assert.ok(
		done?.type === "done" && done.stopReason === "error" && done.errorMessage === "Rate limited",
	);
});

test("a run can be stopped, and the session stays usable", async () => {
	const engine = createScriptedEngine(
		[fauxAssistantMessage("word ".repeat(500)), fauxAssistantMessage("Still here.")],
		200,
	);
	const session = new Session(engine, await tempDir());
	const events: RunEvent[] = [];
	const pending = session.send({ text: "Go", attachmentIds: [] }, (event) => {
		events.push(event);
		if (event.type === "text_delta") session.abort();
	});
	await pending;
	const done = events.at(-1);
	assert.ok(done?.type === "done" && done.stopReason === "aborted");
	assert.equal(streamed(await run(session, "Again")), "Still here.");
});

test("a second message during a run is refused", async () => {
	const engine = createScriptedEngine([fauxAssistantMessage("word ".repeat(100))], 500);
	const session = new Session(engine, await tempDir());
	const first = run(session, "One");
	await assert.rejects(run(session, "Two"), SessionBusyError);
	await first;
});
