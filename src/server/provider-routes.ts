import type { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import type { Engine } from "../harness/engine.ts";
import { ProviderKeyError } from "../harness/provider-keys.ts";

/** Printable characters only, so a stray line break from pasting can't become part of a key. */
const keyInput = z.object({
	key: z
		.string()
		.trim()
		.min(1)
		.max(4096)
		.regex(/^[\x21-\x7e]+$/),
});

/** Keys only ever come in. Nothing here, or in any other route, sends one back. */
export function addProviderKeyRoutes(app: Hono, engine: Engine): void {
	app.put(
		"/api/providers/:id/key",
		bodyLimit({
			maxSize: 64 * 1024,
			onError: (c) => c.json({ error: "That key is too long." }, 413),
		}),
		async (c) => {
			const parsed = keyInput.safeParse(await c.req.json().catch(() => undefined));
			if (!parsed.success) return c.json({ error: "That doesn't look like an API key." }, 400);
			try {
				await engine.saveKey(c.req.param("id"), parsed.data.key);
				return c.json({ ok: true });
			} catch (error) {
				if (error instanceof ProviderKeyError)
					return c.json({ error: error.message }, error.status);
				console.error("Couldn't save a provider key.");
				return c.json({ error: "Couldn't save that key." }, 500);
			}
		},
	);

	app.delete("/api/providers/:id/key", async (c) => {
		await engine.removeKey(c.req.param("id"));
		return c.json({ ok: true });
	});
}
