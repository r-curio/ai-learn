import { fauxAssistantMessage, type FauxResponseFactory } from "@earendil-works/pi-ai";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createScriptedEngine } from "../src/harness/fake-engine.ts";
import { Session, SessionBusyError } from "../src/harness/sessions/session.ts";
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

test("a second message during a run is refused", async () => {
	const engine = createScriptedEngine([fauxAssistantMessage("word ".repeat(100))], 500);
	const session = new Session(engine, await tempDir());
	const first = run(session, "One");
	await assert.rejects(run(session, "Two"), SessionBusyError);
	await first;
});
