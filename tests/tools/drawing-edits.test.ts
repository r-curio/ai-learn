import {
	fauxAssistantMessage,
	fauxText,
	fauxToolCall,
	type FauxResponseFactory,
	type Message,
} from "@earendil-works/pi-ai";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { DRAW } from "../../src/harness/drawings/tools.ts";
import { createScriptedEngine } from "../../src/harness/fake-engine.ts";
import type { LogEntry } from "../../src/harness/sessions/log.ts";
import { Session } from "../../src/harness/sessions/session.ts";
import type { Drawing, SceneElement } from "../../src/shared/drawing.ts";
import { FAKE_CHOICE, PNG, tempDir } from "../helpers.ts";

// A learner's edit is saved with their message, and the model reads a tag the app writes from it.

const DIAGRAM = {
	id: "flow",
	title: "Flow",
	nodes: [
		{ id: "q", label: "Query" },
		{ id: "k", label: "Key" },
		{ id: "s", label: "Scores" },
	],
	edges: [
		{ from: "q", to: "s", label: "compared" },
		{ from: "k", to: "s", label: "compared" },
	],
};

const shape = (id: string, x: number, y: number): SceneElement => ({
	id,
	type: "rectangle",
	x,
	y,
	width: 120,
	height: 60,
});
const label = (containerId: string, text: string): SceneElement => ({
	id: `${containerId}-label`,
	type: "text",
	x: 0,
	y: 0,
	width: 10,
	height: 10,
	text,
	containerId,
});
const arrow = (id: string, from: string, to: string): SceneElement => ({
	id,
	type: "arrow",
	x: 0,
	y: 0,
	width: 10,
	height: 10,
	points: [
		[0, 0],
		[10, 10],
	],
	startBinding: { elementId: from },
	endBinding: { elementId: to },
});

/** The card's elements for a saved drawing, as the editor starts with them. */
function sceneOf(drawing: Drawing): SceneElement[] {
	return [
		...drawing.boxes.flatMap((box) => [
			shape(`box-${box.id}`, box.x, box.y),
			label(`box-${box.id}`, box.label),
		]),
		...drawing.arrows.map((link, index) =>
			arrow(`arrow-${index}`, `box-${link.from}`, `box-${link.to}`),
		),
	];
}

async function chatWithDiagram(reply: FauxResponseFactory) {
	const dataDir = await tempDir();
	const engine = createScriptedEngine([
		fauxAssistantMessage([fauxText("Look."), fauxToolCall(DRAW, DIAGRAM)], {
			stopReason: "toolUse",
		}),
		fauxAssistantMessage("Edit it if you like."),
		reply,
	]);
	const session = new Session(engine, dataDir);
	await session.send({ text: "Draw it", attachmentIds: [] }, () => undefined, FAKE_CHOICE);
	const block = session
		.view()
		.messages.flatMap((message) => message.blocks)
		.find((item) => item.kind === "drawing");
	assert.ok(block?.kind === "drawing");
	return { dataDir, session, callId: block.id, drawing: block.drawing };
}

const textOf = (message: Message | undefined) =>
	message?.role === "user" && Array.isArray(message.content)
		? message.content.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n")
		: "";

test("an edit reaches the model as a tag with a picture, and a reopened chat shows it", async () => {
	let sent: Message | undefined;
	const { dataDir, session, callId, drawing } = await chatWithDiagram((context) => {
		sent = context.messages.at(-1);
		return fauxAssistantMessage("Good thinking about the mask.");
	});
	const elements = sceneOf(drawing)
		.filter((element) => element.id !== "arrow-1")
		.map((element) =>
			element.id === "box-s-label" ? { ...element, text: "Raw scores" } : element,
		);
	elements.push(shape("new-box", 900, 900), label("new-box", "Mask"));
	elements.push(arrow("new-arrow", "new-box", "box-s"));
	elements.push({ id: "pen", type: "freedraw", x: 5, y: 5, width: 40, height: 10 });
	const picture = await session.attachments.add("Flow (edited).png", PNG);

	await session.send(
		{ text: "Like this?", attachmentIds: [], edit: { callId, elements, pictureId: picture.id } },
		() => undefined,
		FAKE_CHOICE,
	);

	const tag = textOf(sent);
	assert.match(tag, /<diagram-edit drawing="flow" title="Flow">/);
	for (const line of [
		'- Renamed "Scores" to "Raw scores"',
		'- Added a box "Mask"',
		'- Removed the arrow "Key" → "Raw scores"',
		'- Added an arrow "Mask" → "Raw scores"',
		"- Drew 1 freehand mark, shown in the attached picture",
		'Boxes now: "Query", "Key", "Raw scores", "Mask"',
	])
		assert.ok(tag.includes(line), `missing: ${line}\n${tag}`);
	assert.ok(sent?.role === "user" && Array.isArray(sent.content));
	assert.equal(sent.content.filter((part) => part.type === "image").length, 1);

	// The picture is for the model, so the learner's message shows no file for it.
	const log = (await readFile(join(dataDir, "sessions", session.id, "session.jsonl"), "utf8"))
		.trim()
		.split("\n")
		.map((line) => JSON.parse(line) as LogEntry);
	const saved = log.find((entry) => entry.type === "message" && entry.drawingEdit);
	assert.ok(saved?.type === "message");
	assert.deepEqual(saved.display?.attachmentIds, []);
	assert.deepEqual(saved.drawingEdit, { callId, elements });

	const mine = session.view().messages.findLast((message) => message.role === "user");
	assert.deepEqual(
		mine?.blocks.map((block) => block.kind),
		["drawing-edit", "text"],
	);
	// A reopened chat sends the model the same tag it saved, rather than writing a new one.
	let resent: Message | undefined;
	const reopened = await Session.load(
		createScriptedEngine([
			((context) => {
				resent = context.messages.findLast(
					(message) => message.role === "user" && textOf(message).includes("<diagram-edit"),
				);
				return fauxAssistantMessage("Again.");
			}) satisfies FauxResponseFactory,
		]),
		dataDir,
		session.id,
	);
	assert.deepEqual(reopened.view().messages, session.view().messages);
	await reopened.send({ text: "And now?", attachmentIds: [] }, () => undefined, FAKE_CHOICE);
	assert.equal(textOf(resent), tag);
});

test("an edit of a drawing that isn't in the chat is refused, and nothing is saved", async () => {
	const { dataDir, session } = await chatWithDiagram(() => fauxAssistantMessage("Never sent."));
	const before = await readFile(join(dataDir, "sessions", session.id, "session.jsonl"), "utf8");
	await assert.rejects(
		session.send(
			{ text: "", attachmentIds: [], edit: { callId: "nope", elements: [] } },
			() => undefined,
			FAKE_CHOICE,
		),
		/isn't in this chat/,
	);
	assert.equal(
		await readFile(join(dataDir, "sessions", session.id, "session.jsonl"), "utf8"),
		before,
	);
});

test("an edit with no changes says so, and a deleted box is reported", async () => {
	let unchanged: Message | undefined;
	const first = await chatWithDiagram((context) => {
		unchanged = context.messages.at(-1);
		return fauxAssistantMessage("Same as mine.");
	});
	await first.session.send(
		{
			text: "",
			attachmentIds: [],
			edit: { callId: first.callId, elements: sceneOf(first.drawing) },
		},
		() => undefined,
		FAKE_CHOICE,
	);
	assert.ok(textOf(unchanged).includes("- Nothing that can be put in words"));

	let sent: Message | undefined;
	const { session, callId, drawing } = await chatWithDiagram((context) => {
		sent = context.messages.at(-1);
		return fauxAssistantMessage("Noted.");
	});
	const elements = sceneOf(drawing).map((element) =>
		element.id === "box-k" ? { ...element, isDeleted: true } : element,
	);
	await session.send(
		{ text: "", attachmentIds: [], edit: { callId, elements } },
		() => undefined,
		FAKE_CHOICE,
	);
	assert.ok(textOf(sent).includes('- Removed the box "Key"'));
	assert.ok(!textOf(sent).includes("freehand"));
});
