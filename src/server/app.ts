import { serveStatic } from "@hono/node-server/serve-static";
import { timingSafeEqual } from "node:crypto";
import { relative } from "node:path";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { AttachmentError, MAX_FILE_BYTES } from "../harness/attachments.ts";
import type { Engine } from "../harness/engine.ts";
import { Session, SessionBusyError } from "../harness/session.ts";

export interface AppOptions {
	engine: Engine;
	dataDir: string;
	/** Secret for this launch. Other programs on this computer can reach the port, but not without it. */
	token: string;
	/** Built UI to serve. Dev mode leaves this to Vite. */
	webRoot?: string;
}

const messageInput = z.object({
	text: z.string().max(200_000),
	attachmentIds: z.array(z.string()).max(20).default([]),
});

const CSP = "default-src 'self'; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'";

function tokensMatch(given: string | undefined, expected: string): boolean {
	const a = Buffer.from(given ?? "");
	const b = Buffer.from(expected);
	return a.length === b.length && timingSafeEqual(a, b);
}

export function createApp({ engine, dataDir, token, webRoot }: AppOptions): Hono {
	const app = new Hono();
	const sessions = new Map<string, Session>();

	// Blocks websites that point their own domain at 127.0.0.1 (DNS rebinding).
	app.use("*", async (c, next) => {
		const host = (c.req.header("host") ?? "").replace(/:\d+$/, "");
		if (host !== "127.0.0.1" && host !== "localhost") return c.json({ error: "Forbidden host." }, 403);
		await next();
	});

	app.use("/api/*", async (c, next) => {
		const header = c.req.header("authorization");
		if (!tokensMatch(header?.replace(/^Bearer /, ""), token)) return c.json({ error: "Unauthorized." }, 401);
		await next();
	});

	app.get("/api/status", (c) => c.json(engine.status()));

	app.post("/api/sessions", (c) => {
		const session = new Session(engine, dataDir);
		sessions.set(session.id, session);
		return c.json({ id: session.id }, 201);
	});

	app.post(
		"/api/sessions/:id/attachments",
		bodyLimit({
			maxSize: MAX_FILE_BYTES + 1024 * 1024,
			onError: (c) => c.json({ error: "That file is over the 25 MB limit." }, 413),
		}),
		async (c) => {
			const session = sessions.get(c.req.param("id"));
			if (!session) return c.json({ error: "Session not found." }, 404);
			const file = (await c.req.formData()).get("file");
			if (!(file instanceof File)) return c.json({ error: "No file was sent." }, 400);
			try {
				return c.json(await session.attachments.add(file.name, new Uint8Array(await file.arrayBuffer())), 201);
			} catch (error) {
				if (error instanceof AttachmentError) return c.json({ error: error.message }, error.status);
				throw error;
			}
		},
	);

	app.post("/api/sessions/:id/messages", async (c) => {
		const session = sessions.get(c.req.param("id"));
		if (!session) return c.json({ error: "Session not found." }, 404);
		const status = engine.status();
		if (!status.ready) return c.json({ error: status.reason }, 503);

		const parsed = messageInput.safeParse(await c.req.json().catch(() => undefined));
		if (!parsed.success) return c.json({ error: "Invalid message." }, 400);
		const { text, attachmentIds } = parsed.data;
		if (!text.trim() && attachmentIds.length === 0) return c.json({ error: "Message is empty." }, 400);
		const unknown = attachmentIds.find((id) => !session.attachments.has(id));
		if (unknown) return c.json({ error: "Unknown attachment." }, 400);

		return streamSSE(c, async (stream) => {
			stream.onAbort(() => session.abort());
			let writes = Promise.resolve();
			try {
				await session.send({ text, attachmentIds }, (event) => {
					writes = writes.then(() => stream.writeSSE({ data: JSON.stringify(event) }));
				});
			} catch (error) {
				const busy = error instanceof SessionBusyError;
				const message = busy ? error.message : "The response failed.";
				if (!busy) console.error(error);
				writes = writes.then(() =>
					stream.writeSSE({
						data: JSON.stringify({
							type: "done",
							stopReason: "error",
							errorMessage: message,
							usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
							sessionUsage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
						}),
					}),
				);
			}
			await writes;
		});
	});

	app.post("/api/sessions/:id/abort", (c) => {
		const session = sessions.get(c.req.param("id"));
		if (!session) return c.json({ error: "Session not found." }, 404);
		session.abort();
		return c.json({ ok: true });
	});

	app.all("/api/*", (c) => c.json({ error: "Not found." }, 404));

	if (webRoot) {
		const root = relative(process.cwd(), webRoot) || ".";
		app.use("*", async (c, next) => {
			await next();
			c.header("Content-Security-Policy", CSP);
			c.header("X-Content-Type-Options", "nosniff");
		});
		app.use("*", serveStatic({ root }));
		app.get("*", serveStatic({ root, path: "index.html" }));
	}
	return app;
}
