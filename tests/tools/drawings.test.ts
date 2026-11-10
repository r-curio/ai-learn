import {
	fauxAssistantMessage,
	fauxText,
	fauxToolCall,
	type FauxResponseFactory,
} from "@earendil-works/pi-ai";
import assert from "node:assert/strict";
import { test } from "node:test";
import { layOut } from "../../src/harness/drawing-layout.ts";
import { DRAW, PLAN } from "../../src/harness/drawing-tools.ts";
import { createScriptedEngine } from "../../src/harness/fake-engine.ts";
import { Session } from "../../src/harness/sessions/session.ts";
import type { RunEvent } from "../../src/shared/protocol.ts";
import { FAKE_CHOICE, tempDir } from "../helpers.ts";

// The layout is saved with each drawing, so a reopened chat shows exactly what was drawn.

const PLAN_INPUT = {
	title: "Understand attention",
	nodes: [
		{ id: "vectors", label: "Words as vectors" },
		{ id: "dot", label: "Dot products" },
		{ id: "attention", label: "Attention" },
	],
	edges: [
		{ from: "vectors", to: "dot" },
		{ from: "dot", to: "attention" },
	],
	groups: [{ id: "maths", label: "The maths", nodes: ["dot"] }],
};
const DIAGRAM = {
	id: "flow",
	title: "Flow",
	nodes: [
		{ id: "a", label: "Query" },
		{ id: "b", label: "Key" },
	],
	edges: [{ from: "a", to: "b", label: "compared" }],
};
const call = (name: string, args: typeof DIAGRAM | typeof PLAN_INPUT) =>
	fauxAssistantMessage([fauxText("Look."), fauxToolCall(name, args)], { stopReason: "toolUse" });
const send = (session: Session, onEvent: (event: RunEvent) => void = () => undefined) =>
	session.send({ text: "Draw it", attachmentIds: [] }, onEvent, FAKE_CHOICE);
const drawingsIn = (session: Session) =>
	session
		.view()
		.messages.flatMap((message) => message.blocks)
		.flatMap((block) => (block.kind === "drawing" ? [block.drawing] : []));

test("a drawing's layout is saved with its result, and a reopened chat shows the same one", async () => {
	const dataDir = await tempDir();
	let sentResult: unknown;
	const engine = createScriptedEngine([
		call(PLAN, PLAN_INPUT),
		((context) => {
			sentResult = context.messages.at(-1);
			return fauxAssistantMessage("Start at the bottom.");
		}) satisfies FauxResponseFactory,
		call(DRAW, DIAGRAM),
		fauxAssistantMessage("Done."),
		call(DRAW, { ...DIAGRAM, title: "Flow, again" }),
		fauxAssistantMessage("Updated."),
	]);
	const session = new Session(engine, dataDir);
	const events: RunEvent[] = [];
	await send(session, (event) => events.push(event));
	await send(session);
	await send(session);

	const drawings = drawingsIn(session);
	assert.deepEqual(
		drawings.map(({ id, kind, title }) => [id, kind, title]),
		[
			["plan", "plan", "Understand attention"],
			["flow", "diagram", "Flow"],
			["flow", "diagram", "Flow, again"],
		],
	);
	// The plan grows upward: the goal is above the idea it needs, and that is above the foundation.
	const y = (id: string) => drawings[0]!.boxes.find((box) => box.id === id)!.y;
	assert.ok(y("attention") < y("dot") && y("dot") < y("vectors"));
	assert.deepEqual(
		drawings[0]!.groups.map((group) => group.label),
		["The maths"],
	);
	assert.ok(events.some((event) => event.type === "drawing" && event.drawing.id === "plan"));

	// The model reads only the result's text, never the positions.
	assert.ok(sentResult && typeof sentResult === "object");
	assert.equal(JSON.stringify((sentResult as { content: unknown }).content).includes('"x"'), false);

	const reopened = await Session.load(createScriptedEngine([]), dataDir, session.id);
	assert.deepEqual(reopened.view().messages, session.view().messages);
});

test("a description that names a missing node fails, so the tutor can fix it", async () => {
	const broken = { ...DIAGRAM, edges: [{ from: "a", to: "nowhere", label: "x" }] };
	const engine = createScriptedEngine([call(DRAW, broken), fauxAssistantMessage("Fixing it.")]);
	const session = new Session(engine, await tempDir());
	await send(session);
	const blocks = session.view().messages.flatMap((message) => message.blocks);
	assert.ok(blocks.some((block) => block.kind === "tool" && block.state === "failed"));
	assert.equal(drawingsIn(session).length, 0);
});

test("the same description always gets the same layout", async () => {
	const description = { ...PLAN_INPUT, id: "plan", kind: "plan" as const };
	assert.deepEqual(await layOut(description), await layOut(description));
});

test("a drawing comes before a question asked in the same step, live and reopened", async () => {
	const reply = fauxAssistantMessage(
		[
			fauxToolCall(PLAN, PLAN_INPUT),
			fauxToolCall("ask_question", { question: "Where to start?", choices: ["A", "B"] }),
		],
		{ stopReason: "toolUse" },
	);
	const dataDir = await tempDir();
	const session = new Session(createScriptedEngine([reply]), dataDir);
	await send(session);
	const kinds = (view: ReturnType<Session["view"]>) =>
		view.messages.at(-1)!.blocks.map((block) => block.kind);
	assert.deepEqual(kinds(session.view()), ["tool", "drawing", "question"]);
	const reopened = await Session.load(createScriptedEngine([]), dataDir, session.id);
	assert.deepEqual(kinds(reopened.view()), ["tool", "drawing", "question"]);
});
