import type { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { Engine } from "../harness/engine.ts";
import { MAX_VOICE_BYTES, VOICE_AUDIO_TYPES, VoiceError } from "../harness/transcription.ts";
import { readPreferences } from "./preferences.ts";

const VOICE_OFF = "Voice isn't set up. Choose how speech becomes text in Settings.";

/** The page sends a recording and gets text back. Keys stay here, with the engine. */
export function addVoiceRoutes(app: Hono, engine: Engine, dataDir: string): void {
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
			const engineId = (await readPreferences(dataDir)).voice;
			const choice = (await engine.status()).voice.find(({ id }) => id === engineId);
			if (!choice) return c.json({ error: VOICE_OFF }, 409);
			if (!choice.connected)
				return c.json({ error: `Add a ${choice.label} key in Settings to use voice.` }, 409);
			const audio = new Uint8Array(await c.req.arrayBuffer());
			if (audio.length === 0) return c.json({ error: "The recording was empty." }, 400);
			try {
				return c.json({ text: await engine.transcribe(choice.id, { audio, mimeType }) });
			} catch (error) {
				if (error instanceof VoiceError) return c.json({ error: error.message }, error.status);
				console.error("A transcription failed.");
				return c.json({ error: "Couldn't transcribe that recording." }, 500);
			}
		},
	);
}
