import type { Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { Engine } from "../harness/engine.ts";
import { MAX_VOICE_BYTES, VOICE_AUDIO_TYPES, VoiceError } from "../harness/transcription.ts";
import { readPreferences } from "./preferences.ts";

const VOICE_OFF = "Voice isn't set up. Choose how speech becomes text in Settings.";

/** A voice engine's failure as a reply. Anything unexpected gets a fixed message, since it could carry request details. */
function failure(c: Context, error: unknown, what: string) {
	if (error instanceof VoiceError) return c.json({ error: error.message }, error.status);
	console.error(`${what} failed.`);
	return c.json({ error: `${what} failed.` }, 500);
}

/** The engine to use, or why it can't be used yet. */
async function connectedEngine(engine: Engine, engineId: string | undefined) {
	const choice = (await engine.status()).voice.find(({ id }) => id === engineId);
	if (!choice) return { error: VOICE_OFF };
	if (!choice.connected) return { error: `Add your ${choice.label} key in Settings to use voice.` };
	return { id: choice.id };
}

/** The page sends a recording and gets text back. Keys stay here, with the engine. */
export function addVoiceRoutes(app: Hono, engine: Engine, dataDir: string): void {
	app.get("/api/voice/engines/:id/models", async (c) => {
		const found = await connectedEngine(engine, c.req.param("id"));
		if (found.error !== undefined) return c.json({ error: found.error }, 409);
		try {
			return c.json(await engine.voiceModels(found.id));
		} catch (error) {
			return failure(c, error, "Listing voice models");
		}
	});

	app.post(
		"/api/voice/transcribe",
		bodyLimit({
			maxSize: MAX_VOICE_BYTES,
			onError: (c) => c.json({ error: "That recording is too long to transcribe." }, 413),
		}),
		async (c) => {
			const mimeType =
				(c.req.header("content-type") ?? "").toLowerCase().split(";")[0]?.trim() ?? "";
			if (!Object.hasOwn(VOICE_AUDIO_TYPES, mimeType))
				return c.json({ error: "That recording's format isn't supported." }, 415);
			const { voice, voiceModel } = await readPreferences(dataDir);
			const found = await connectedEngine(engine, voice);
			if (found.error !== undefined) return c.json({ error: found.error }, 409);
			const audio = new Uint8Array(await c.req.arrayBuffer());
			if (audio.length === 0) return c.json({ error: "The recording was empty." }, 400);
			try {
				return c.json({ text: await engine.transcribe(found.id, { audio, mimeType }, voiceModel) });
			} catch (error) {
				return failure(c, error, "Transcribing that recording");
			}
		},
	);
}
