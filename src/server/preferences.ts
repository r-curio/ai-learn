import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type { Preferences } from "../shared/protocol.ts";

export const preferencesInput = z.object({ sidebarOpen: z.boolean() });

const DEFAULTS: Preferences = { sidebarOpen: true };
const FILE_NAME = "preferences.json";

/** A missing or damaged file falls back to the defaults, since these are only conveniences. */
export async function readPreferences(dataDir: string): Promise<Preferences> {
	try {
		const raw: unknown = JSON.parse(await readFile(join(dataDir, FILE_NAME), "utf8"));
		return preferencesInput.parse(raw);
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
