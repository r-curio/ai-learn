import { serveStatic } from "@hono/node-server/serve-static";
import { timingSafeEqual } from "node:crypto";
import { relative } from "node:path";
import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { AttachmentError, MAX_FILE_BYTES } from "../harness/attachments.ts";
import type { Engine } from "../harness/engine.ts";
import type { Session } from "../harness/sessions/session.ts";
import { SessionBusyError, SessionStateError } from "../harness/sessions/session.ts";
import { SessionStore } from "../harness/sessions/store.ts";
import { EFFORTS, type RunEvent } from "../shared/protocol.ts";
import { preferencesInput, readPreferences, writePreferences } from "./preferences.ts";
import { SessionLogError } from "../harness/sessions/log.ts";

export interface AppOptions {
	engine: Engine;
	dataDir: string;
	/** Secret for this launch. Other programs on this computer can reach the port, but not without it. */
	token: string;
	/** Built UI to serve. Dev mode leaves this to Vite. */
	webRoot?: string;
}

const modelSelection = z
	.object({ provider: z.string(), id: z.string(), effort: z.enum(EFFORTS).optional() })
	.optional();

const messageInput = z.object({
	text: z.string().max(200_000),
	attachmentIds: z.array(z.string()).max(20).default([]),
	model: modelSelection,
});

const retryInput = z.object({ model: modelSelection });

const UNAVAILABLE_MODEL = "That model or effort isn't available.";

const CSP =
	"default-src 'self'; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'";

function tokensMatch(given: string | undefined, expected: string): boolean {
	const a = Buffer.from(given ?? "");
	const b = Buffer.from(expected);
	return a.length === b.length && timingSafeEqual(a, b);
}

const NO_USAGE = { inputTokens: 0, outputTokens: 0, costUsd: 0 };

/** Stream a run's events to the client. A client that disconnects stops the run. */
function streamRun(
	c: Context,
	session: Session,
	run: (onEvent: (event: RunEvent) => void) => Promise<void>,
) {
	return streamSSE(c, async (stream) => {
		stream.onAbort(() => session.abort());
		let writes = Promise.resolve();
		const emit = (event: RunEvent) => {
			writes = writes.then(() => stream.writeSSE({ data: JSON.stringify(event) }));
		};
		try {
			await run(emit);
		} catch (error) {
			const expected = error instanceof SessionBusyError || error instanceof SessionStateError;
			if (!expected) console.error(error);
			emit({
				type: "done",
				stopReason: "error",
				errorMessage: expected ? error.message : "The response failed.",
				usage: NO_USAGE,
				sessionUsage: NO_USAGE,
			});
		}
		await writes;
	});
}

export function createApp({ engine, dataDir, token, webRoot }: AppOptions): Hono {
	const app = new Hono();
	const store = new SessionStore(engine, dataDir);

	app.onError((error, c) => {
		if (error instanceof SessionLogError) return c.json({ error: error.message }, 422);
		if (error instanceof SessionBusyError) return c.json({ error: error.message }, 409);
		console.error(error);
		return c.json({ error: "Something went wrong." }, 500);
	});

	// Blocks websites that point their own domain at 127.0.0.1 (DNS rebinding).
	app.use("*", async (c, next) => {
		const host = (c.req.header("host") ?? "").replace(/:\d+$/, "");
		if (host !== "127.0.0.1" && host !== "localhost")
			return c.json({ error: "Forbidden host." }, 403);
		await next();
	});

	app.use("/api/*", async (c, next) => {
		const header = c.req.header("authorization");
		if (!tokensMatch(header?.replace(/^Bearer /, ""), token))
			return c.json({ error: "Unauthorized." }, 401);
		await next();
	});

	app.get("/api/status", async (c) => c.json(await engine.status()));

	app.get("/api/preferences", async (c) => c.json(await readPreferences(dataDir)));

	app.put("/api/preferences", async (c) => {
		const parsed = preferencesInput.safeParse(await c.req.json().catch(() => undefined));
		if (!parsed.success) return c.json({ error: "Invalid preferences." }, 400);
		const preferences = { ...(await readPreferences(dataDir)), ...parsed.data };
		await writePreferences(dataDir, preferences);
		return c.json(preferences);
	});

	app.get("/api/sessions", async (c) => c.json(await store.list()));

	app.post("/api/sessions", (c) => c.json({ id: store.create().id }, 201));

	app.get("/api/sessions/:id", async (c) => {
		const session = await store.get(c.req.param("id"));
		return session ? c.json(session.view()) : c.json({ error: "Session not found." }, 404);
	});

	app.delete("/api/sessions/:id", async (c) => {
		return (await store.delete(c.req.param("id")))
			? c.json({ ok: true })
			: c.json({ error: "Session not found." }, 404);
	});

	app.get("/api/sessions/:id/attachments/:attachmentId", async (c) => {
		const image = (await store.get(c.req.param("id")))?.attachments.image(
			c.req.param("attachmentId"),
		);
		if (!image) return c.json({ error: "Image not found." }, 404);
		return c.body(new Uint8Array(image.bytes), 200, {
			"Content-Type": image.mimeType,
			"X-Content-Type-Options": "nosniff",
		});
	});

	app.post(
		"/api/sessions/:id/attachments",
		bodyLimit({
			maxSize: MAX_FILE_BYTES + 1024 * 1024,
			onError: (c) => c.json({ error: "That file is over the 25 MB limit." }, 413),
		}),
		async (c) => {
			const session = await store.get(c.req.param("id"));
			if (!session) return c.json({ error: "Session not found." }, 404);
			const file = (await c.req.formData()).get("file");
			if (!(file instanceof File)) return c.json({ error: "No file was sent." }, 400);
			try {
				return c.json(
					await session.attachments.add(file.name, new Uint8Array(await file.arrayBuffer())),
					201,
				);
			} catch (error) {
				if (error instanceof AttachmentError) return c.json({ error: error.message }, error.status);
				throw error;
			}
		},
	);

	app.post("/api/sessions/:id/messages", async (c) => {
		const session = await store.get(c.req.param("id"));
		if (!session) return c.json({ error: "Session not found." }, 404);
		const status = await engine.status();
		if (!status.ready) return c.json({ error: status.reason }, 503);

		const parsed = messageInput.safeParse(await c.req.json().catch(() => undefined));
		if (!parsed.success) return c.json({ error: "Invalid message." }, 400);
		const { text, attachmentIds, model } = parsed.data;
		if (!text.trim() && attachmentIds.length === 0)
			return c.json({ error: "Message is empty." }, 400);
		const unknown = attachmentIds.find((id) => !session.attachments.has(id));
		if (unknown) return c.json({ error: "Unknown attachment." }, 400);
		const choice = model && (await engine.resolve(model));
		if (model && !choice) return c.json({ error: UNAVAILABLE_MODEL }, 400);

		return streamRun(c, session, (onEvent) =>
			session.send({ text, attachmentIds }, onEvent, choice),
		);
	});

	app.post("/api/sessions/:id/retry", async (c) => {
		const session = await store.get(c.req.param("id"));
		if (!session) return c.json({ error: "Session not found." }, 404);
		const status = await engine.status();
		if (!status.ready) return c.json({ error: status.reason }, 503);
		// A body is optional here, since a retry can stay on the model already in use.
		const parsed = retryInput.safeParse(await c.req.json().catch(() => ({})));
		if (!parsed.success) return c.json({ error: "Invalid retry." }, 400);
		const { model } = parsed.data;
		const choice = model && (await engine.resolve(model));
		if (model && !choice) return c.json({ error: UNAVAILABLE_MODEL }, 400);
		return streamRun(c, session, (onEvent) => session.retry(onEvent, choice));
	});

	app.post("/api/sessions/:id/abort", async (c) => {
		const session = await store.get(c.req.param("id"));
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
