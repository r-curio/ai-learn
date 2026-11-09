import {
	fauxAssistantMessage,
	fauxText,
	fauxToolCall,
	type FauxResponseFactory,
} from "@earendil-works/pi-ai";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { createScriptedEngine } from "../../src/harness/fake-engine.ts";
import type { LogEntry, LogMessage } from "../../src/harness/sessions/log.ts";
import { Session } from "../../src/harness/sessions/session.ts";
import { buildTranscript } from "../../src/harness/sessions/transcript.ts";
import { createApp } from "../../src/server/app.ts";
import type { RunEvent, SessionView } from "../../src/shared/protocol.ts";
import { FAKE_CHOICE, tempDir } from "../helpers.ts";

const QUESTION = { question: "Which vector asks?", choices: ["The key", "The query"] };
const ask = (...extra: ReturnType<typeof fauxToolCall>[]) =>
	fauxAssistantMessage(
		[fauxText("A quick check."), fauxToolCall("ask_question", QUESTION), ...extra],
		{ stopReason: "toolUse" },
	);
const noEvents = () => undefined;
const logPath = (dataDir: string, id: string) => join(dataDir, "sessions", id, "session.jsonl");
const logMessages = async (dataDir: string, id: string) =>
	(await readFile(logPath(dataDir, id), "utf8"))
		.trim()
		.split("\n")
		.map((line) => JSON.parse(line) as LogEntry)
		.filter((entry): entry is LogMessage => entry.type === "message");
const sendTurn = (session: Session, text = "Quiz me") =>
	session.send({ text, attachmentIds: [] }, noEvents, FAKE_CHOICE);

test("a question ends the run, and only the tool call with no result is saved", async () => {
	const dataDir = await tempDir();
	const engine = createScriptedEngine([ask()]);
	const session = new Session(engine, dataDir);
	const events: RunEvent[] = [];
	await session.send({ text: "Quiz me", attachmentIds: [] }, (e) => events.push(e), FAKE_CHOICE);

	const roles = (await logMessages(dataDir, session.id)).map((line) => line.message.role);
	assert.deepEqual(roles, ["user", "assistant"]);
	assert.equal(engine.faux.state.callCount, 1);
	assert.equal(events.at(-1)?.type, "done");
	assert.ok(!events.some((event) => event.type === "tool_start"));

	const view = session.view();
	assert.equal(view.pendingQuestion?.text, QUESTION.question);
	assert.deepEqual(view.pendingQuestion?.choices, QUESTION.choices);
	assert.equal(view.canRetry, false);
	assert.ok(!view.messages.at(-1)?.blocks.some((block) => block.kind === "tool"));

	await assert.rejects(sendTurn(session, "Never mind"), /Answer the tutor's question/);
	await assert.rejects(session.retry(noEvents, FAKE_CHOICE), /nothing to retry/);
});

test("an answer is on disk before the model is called, and its reasoning reaches only the model", async () => {
	const dataDir = await tempDir();
	let sent: unknown;
	let savedBeforeCall = false;
	const session: Session = new Session(
		createScriptedEngine([
			ask(),
			((context) => {
				sent = context.messages.at(-1);
				savedBeforeCall = readFileSync(logPath(dataDir, session.id), "utf8").includes('"answer":');
				return fauxAssistantMessage("Your reasoning holds up.");
			}) satisfies FauxResponseFactory,
		]),
		dataDir,
	);
	await sendTurn(session);
	const question = session.pendingQuestion!;
	const answer = {
		kind: "choice",
		choice: 1,
		confidence: 70,
		reasoning: "It is the word asking.",
	} as const;
	await session.answer(question.id, answer, noEvents, FAKE_CHOICE);
	assert.equal(savedBeforeCall, true);

	const saved = (await logMessages(dataDir, session.id)).find((line) => line.answer);
	assert.deepEqual(saved?.answer, answer);
	assert.equal(saved?.message.role === "toolResult" && saved.message.toolCallId, question.id);
	const text = (sent as { content: { text: string }[] }).content[0]?.text;
	assert.match(text ?? "", /The query/);
	assert.match(text ?? "", /70/);
	assert.match(text ?? "", /It is the word asking/);

	const view = session.view();
	assert.equal(view.pendingQuestion, undefined);
	assert.deepEqual(
		view.messages.map((message) => message.role),
		["user", "assistant", "user", "assistant"],
	);
	const bubble = view.messages[2];
	assert.deepEqual(bubble?.blocks, [{ kind: "text", text: "The query" }]);
	assert.equal(bubble?.confidence, 70);
	assert.ok(!JSON.stringify(view).includes("It is the word asking"));
	assert.ok(!session.searchText().includes("It is the word asking"));
	assert.match(session.searchText(), /Which vector asks/);
});

test("reloading a waiting chat changes nothing, and the answer replays the saved reply exactly", async () => {
	const dataDir = await tempDir();
	const first = new Session(createScriptedEngine([ask()]), dataDir);
	await sendTurn(first);
	const before = await readFile(logPath(dataDir, first.id));
	const savedReply = (await logMessages(dataDir, first.id)).at(-1)?.message;

	let replayed: unknown;
	const reopened = await Session.load(
		createScriptedEngine([
			(context) => {
				replayed = context.messages.find((message) => message.role === "assistant");
				return fauxAssistantMessage("Thanks.");
			},
		]),
		dataDir,
		first.id,
	);
	assert.deepEqual(await readFile(logPath(dataDir, first.id)), before);
	assert.equal(reopened.view().pendingQuestion?.id, first.pendingQuestion?.id);

	await reopened.answer(reopened.pendingQuestion!.id, { kind: "unknown" }, noEvents, FAKE_CHOICE);
	assert.deepEqual(replayed, savedReply);
	const after = await readFile(logPath(dataDir, first.id));
	assert.deepEqual(after.subarray(0, before.length), before);

	const view = (await Session.load(createScriptedEngine([]), dataDir, first.id)).view();
	assert.equal(view.pendingQuestion, undefined);
	assert.equal(view.messages[2]?.confidence, undefined);
	assert.deepEqual(view.messages[2]?.blocks, [{ kind: "text", text: "I don't know" }]);
});

test("a second question gets an error, and tools beside the first still finish", async () => {
	const dataDir = await tempDir();
	const engine = createScriptedEngine([
		ask(
			fauxToolCall("ask_question", { question: "Another?", choices: ["Yes", "No"] }),
			fauxToolCall("read_attachment", { id: "missing" }),
		),
	]);
	const session = new Session(engine, dataDir);
	await sendTurn(session);

	assert.equal(engine.faux.state.callCount, 1);
	assert.equal(session.pendingQuestion?.text, QUESTION.question);
	assert.equal(session.canRetry, false);
	const results = (await logMessages(dataDir, session.id)).flatMap(({ message }) =>
		message.role === "toolResult" ? [[message.toolName, message.isError]] : [],
	);
	assert.deepEqual(results, [
		["ask_question", true],
		["read_attachment", true],
	]);
	assert.equal(
		(await Session.load(createScriptedEngine([]), dataDir, session.id)).pendingQuestion?.id,
		session.pendingQuestion?.id,
	);
});

test("a question with bad arguments isn't left waiting, and the tutor hears why", async () => {
	const dataDir = await tempDir();
	const engine = createScriptedEngine([
		fauxAssistantMessage(fauxToolCall("ask_question", { question: "Sure?", choices: ["Yes"] }), {
			stopReason: "toolUse",
		}),
		fauxAssistantMessage("Let me ask that differently."),
	]);
	const session = new Session(engine, dataDir);
	await sendTurn(session);
	assert.equal(engine.faux.state.callCount, 2);
	assert.equal(session.pendingQuestion, undefined);
});

test("a question with an extra argument gets an error, even after a reload", async () => {
	const dataDir = await tempDir();
	const extra = { ...QUESTION, correct_index: 1 };
	const engine = createScriptedEngine([
		fauxAssistantMessage(fauxToolCall("ask_question", extra), { stopReason: "toolUse" }),
		fauxAssistantMessage("Let me ask that properly."),
	]);
	const session = new Session(engine, dataDir);
	await sendTurn(session);
	assert.equal(engine.faux.state.callCount, 2);
	assert.equal(session.pendingQuestion, undefined);
	assert.equal(session.canRetry, false);
	const reply = session.view().messages.at(-1);
	assert.ok(reply?.blocks.some((block) => block.kind === "tool" && block.state === "failed"));
	assert.ok(!reply?.blocks.some((block) => block.kind === "question"));
	assert.equal(reply?.notice, undefined);
	const reopened = await Session.load(createScriptedEngine([]), dataDir, session.id);
	assert.equal(reopened.pendingQuestion, undefined);
});

test("the answer route accepts only answers that fit the waiting question", async () => {
	const token = "test-token";
	const base = "http://127.0.0.1:1234";
	const headers = {
		Authorization: `Bearer ${token}`,
		Host: "127.0.0.1:1234",
		"Content-Type": "application/json",
	};
	const app = createApp({
		engine: createScriptedEngine([ask(), fauxAssistantMessage("Thanks.")]),
		dataDir: await tempDir(),
		token,
	});
	const { id } = (await (
		await app.request(`${base}/api/sessions`, { method: "POST", headers })
	).json()) as { id: string };
	const model = { provider: "faux", id: "fake-model", effort: "medium" };
	await (
		await app.request(`${base}/api/sessions/${id}/messages`, {
			method: "POST",
			headers,
			body: JSON.stringify({ text: "Quiz me", model }),
		})
	).text();
	const view = async () =>
		(await (await app.request(`${base}/api/sessions/${id}`, { headers })).json()) as SessionView;
	const questionId = (await view()).pendingQuestion!.id;
	const post = (body: object) =>
		app.request(`${base}/api/sessions/${id}/answer`, {
			method: "POST",
			headers,
			body: JSON.stringify({ model, questionId, ...body }),
		});

	const refused: [object, number][] = [
		[{ answer: { kind: "unknown", confidence: 50 } }, 400],
		[{ answer: { kind: "choice", choice: 0 } }, 400],
		[{ answer: { kind: "choice", choice: 2, confidence: 50 } }, 400],
		[{ answer: { kind: "choice", choice: 0, confidence: 101 } }, 400],
		[{ answer: { kind: "own", text: "  ", confidence: 50 } }, 400],
		[{ questionId: "stale", answer: { kind: "unknown" } }, 409],
	];
	for (const [body, status] of refused) assert.equal((await post(body)).status, status);
	assert.equal((await view()).pendingQuestion?.id, questionId);

	const accepted = await post({ answer: { kind: "own", text: "The asker", confidence: 40 } });
	assert.match(await accepted.text(), /Thanks/);
	assert.equal((await view()).pendingQuestion, undefined);
	assert.equal((await post({ answer: { kind: "unknown" } })).status, 409);
});

test("the transcript removes a made-up citation from a question, and the log keeps it", () => {
	const question = 'Which vector asks?<cite attachment="a" page="4">a made-up quote</cite>';
	const reply = fauxAssistantMessage(
		fauxToolCall("ask_question", { question, choices: ["Yes", "No"] }),
		{ stopReason: "toolUse" },
	);
	const entry = { type: "message", id: "1", timestamp: 1, message: reply } as unknown as LogEntry;
	const [message] = buildTranscript(
		[entry],
		() => undefined,
		() => false,
	);
	const block = message?.blocks.find(({ kind }) => kind === "question");
	assert.equal(block?.kind === "question" && block.text, "Which vector asks?");
	assert.ok(JSON.stringify(entry).includes("<cite"));
});
