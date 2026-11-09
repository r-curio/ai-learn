import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { EFFORTS, type Preferences, type PreferencesChange } from "../shared/protocol.ts";

const savedPreferences = z.object({
	sidebarOpen: z.boolean(),
	model: z.object({ provider: z.string(), id: z.string() }).optional(),
	effort: z.enum(EFFORTS).optional(),
	voice: z.string().max(100).optional(),
	voiceModel: z.string().max(200).optional(),
});

/** Each setting saves on its own, without needing the others. A `null` voice turns voice off. */
export const preferencesInput = savedPreferences.partial().extend({
	voice: z.string().max(100).nullable().optional(),
	voiceModel: z.string().max(200).nullable().optional(),
});

/** Apply a change, removing any setting it sets to `null`. */
export function applyChange(saved: Preferences, change: PreferencesChange): Preferences {
	const next: Record<string, unknown> = { ...saved };
	for (const [key, value] of Object.entries(change)) {
		if (value === null) delete next[key];
		else if (value !== undefined) next[key] = value;
	}
	return next as unknown as Preferences;
}

const DEFAULTS: Preferences = { sidebarOpen: true };
const FILE_NAME = "preferences.json";

/** A missing or damaged file falls back to the defaults, since these are only conveniences. */
export async function readPreferences(dataDir: string): Promise<Preferences> {
	try {
		const raw: unknown = JSON.parse(await readFile(join(dataDir, FILE_NAME), "utf8"));
		return savedPreferences.parse(raw);
	} catch {
		return DEFAULTS;
	}
}

export async function writePreferences(dataDir: string, preferences: Preferences): Promise<void> {
	await mkdir(dataDir, { recursive: true });
	const temporary = join(dataDir, `${FILE_NAME}.${randomUUID()}.tmp`);
	await writeFile(temporary, JSON.stringify(preferences));
	await rename(temporary, join(dataDir, FILE_NAME));
}
