import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { test } from "node:test";
import { tempDir } from "./helpers.ts";

const FAKE_MODEL = { provider: "faux", id: "fake-model", effort: "medium" };
const TOKEN = "crash-test-token";
const PORT = 18999;
const BASE = `http://127.0.0.1:${PORT}`;
const headers = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

async function startServer(dataDir: string): Promise<ChildProcess> {
	const child = spawn(
		process.execPath,
		[
			"--import",
			"tsx",
			"--import",
			"./scripts/markdown-imports.mjs",
			"--input-type=module",
			"-e",
			`
			import { startServer } from "./src/server/index.ts";
			await startServer({ dataDir: ${JSON.stringify(dataDir)}, port: ${PORT}, token: ${JSON.stringify(TOKEN)} });
			console.log("ready");
		`,
		],
		{ env: { ...process.env, AI_LEARN_FAKE_MODEL: "1" }, stdio: ["ignore", "pipe", "inherit"] },
	);
	await once(child.stdout, "data");
	return child;
}

test(
	"killing the process mid-reply loses nothing the learner sent, and retry works",
	{ timeout: 30_000 },
	async () => {
		const dataDir = await tempDir();
		const first = await startServer(dataDir);
		let id: string;
		try {
			id = (
				(await (await fetch(`${BASE}/api/sessions`, { method: "POST", headers })).json()) as {
					id: string;
				}
			).id;
			const response = await fetch(`${BASE}/api/sessions/${id}/messages`, {
				method: "POST",
				headers,
				body: JSON.stringify({ text: "Tell me about cells", model: FAKE_MODEL }),
			});
			// Wait until the reply is streaming, then kill the server with no chance to clean up.
			await response.body!.getReader().read();
		} finally {
			first.kill("SIGKILL");
			await once(first, "exit");
		}

		const second = await startServer(dataDir);
		try {
			const listed = (await (await fetch(`${BASE}/api/sessions`, { headers })).json()) as {
				id: string;
				title: string;
			}[];
			assert.equal(listed[0]?.id, id);
			assert.equal(listed[0]?.title, "Tell me about cells");

			const view = (await (await fetch(`${BASE}/api/sessions/${id}`, { headers })).json()) as {
				canRetry: boolean;
				messages: { role: string; blocks: { text?: string }[]; notice?: string }[];
			};
			assert.equal(view.messages[0]?.blocks[0]?.text, "Tell me about cells");
			assert.equal(view.canRetry, true);
			assert.match(view.messages.at(-1)?.notice ?? "", /closed before/);

			const retried = await fetch(`${BASE}/api/sessions/${id}/retry`, {
				method: "POST",
				headers,
				body: JSON.stringify({ model: FAKE_MODEL }),
			});
			assert.match(await retried.text(), /Fake model/);
			const after = (await (await fetch(`${BASE}/api/sessions/${id}`, { headers })).json()) as {
				canRetry: boolean;
			};
			assert.equal(after.canRetry, false);
		} finally {
			second.kill("SIGKILL");
			await once(second, "exit");
		}
	},
);

test("a question survives a crash, and so does the answer to it", { timeout: 30_000 }, async () => {
	const dataDir = await tempDir();
	const url = (id: string, path = "") => `${BASE}/api/sessions/${id}${path}`;
	const read = async (id: string) =>
		(await (await fetch(url(id), { headers })).json()) as {
			canRetry: boolean;
			pendingQuestion?: { id: string; choices: string[] };
			messages: { role: string; blocks: { text?: string }[] }[];
		};

	const first = await startServer(dataDir);
	let id: string;
	try {
		id = (
			(await (await fetch(`${BASE}/api/sessions`, { method: "POST", headers })).json()) as {
				id: string;
			}
		).id;
		const asked = await fetch(url(id, "/messages"), {
			method: "POST",
			headers,
			body: JSON.stringify({ text: "fake:ask", model: FAKE_MODEL }),
		});
		await asked.text();
	} finally {
		first.kill("SIGKILL");
		await once(first, "exit");
	}

	const second = await startServer(dataDir);
	try {
		const waiting = await read(id);
		assert.equal(waiting.pendingQuestion?.choices[1], "The query");
		assert.equal(waiting.canRetry, false);
		const answering = await fetch(url(id, "/answer"), {
			method: "POST",
			headers,
			body: JSON.stringify({
				questionId: waiting.pendingQuestion?.id,
				answer: { kind: "choice", choice: 1, confidence: 70 },
				model: FAKE_MODEL,
			}),
		});
		// The answer is saved before the reply starts, so a crash here can't lose it.
		await answering.body!.getReader().read();
	} finally {
		second.kill("SIGKILL");
		await once(second, "exit");
	}

	const third = await startServer(dataDir);
	try {
		const interrupted = await read(id);
		assert.equal(interrupted.pendingQuestion, undefined);
		assert.equal(interrupted.canRetry, true);
		assert.equal(interrupted.messages[2]?.blocks[0]?.text, "The query");
		const retried = await fetch(url(id, "/retry"), {
			method: "POST",
			headers,
			body: JSON.stringify({ model: FAKE_MODEL }),
		});
		assert.match(await retried.text(), /"stopReason":"stop"/);
		assert.equal((await read(id)).canRetry, false);
	} finally {
		third.kill("SIGKILL");
		await once(third, "exit");
	}
});
