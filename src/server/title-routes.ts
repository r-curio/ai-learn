import type { Hono } from "hono";
import { z } from "zod";
import { SessionStateError } from "../harness/sessions/session.ts";
import type { SessionStore } from "../harness/sessions/store.ts";

const titleInput = z.object({
	title: z
		.string()
		.trim()
		.min(1, "A chat needs a title.")
		.max(200, "A title can be up to 200 characters."),
});

/** The learner renames a chat. Their title is saved in the log, and the tutor's never replaces it. */
export function addTitleRoutes(app: Hono, store: SessionStore): void {
	app.put("/api/sessions/:id/title", async (c) => {
		const session = await store.get(c.req.param("id"));
		if (!session) return c.json({ error: "Session not found." }, 404);
		const parsed = titleInput.safeParse(await c.req.json().catch(() => undefined));
		if (!parsed.success)
			return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid title." }, 400);
		try {
			return c.json({ title: await session.rename(parsed.data.title) });
		} catch (error) {
			if (error instanceof SessionStateError) return c.json({ error: error.message }, 409);
			throw error;
		}
	});
}
