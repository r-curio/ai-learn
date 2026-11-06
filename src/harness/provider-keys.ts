import type { Credential, CredentialInfo, CredentialStore } from "@earendil-works/pi-ai";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** Encryption from outside the harness. The desktop app's comes from the system keychain. */
export interface KeyCipher {
	/** Why real encryption can't be used here, or nothing if it can. */
	unavailableReason(): string | undefined;
	encrypt(text: string): Buffer;
	decrypt(data: Buffer): string;
}

/** A saved-key request that can't be done, with a reason that's safe to show the learner. */
export class ProviderKeyError extends Error {
	constructor(
		message: string,
		readonly status: 400 | 409 | 503,
	) {
		super(message);
	}
}

const FILE_NAME = "provider-keys.json";

/**
 * API keys saved by the learner, encrypted on disk and readable only by their account. Keys are
 * decrypted one at a time when a request needs them, and nothing here logs or returns one except
 * `read`, which only Pi's request code uses.
 */
export class ProviderKeyStore implements CredentialStore {
	private entries?: Map<string, string>;
	private writes: Promise<unknown> = Promise.resolve();

	constructor(
		private readonly dataDir: string,
		private readonly cipher: KeyCipher | undefined,
		/** An environment variable wins over a saved key (ADR 0009). */
		private readonly hasEnvironmentKey: (providerId: string) => Promise<boolean>,
	) {}

	unavailableReason(): string | undefined {
		if (!this.cipher) return "Saving keys needs the desktop app. Add keys to .env.local here.";
		return this.cipher.unavailableReason();
	}

	/** A missing or damaged file means no saved keys. The learner can add them again. */
	private async load(): Promise<Map<string, string>> {
		if (this.entries) return this.entries;
		let entries = new Map<string, string>();
		try {
			const raw = JSON.parse(await readFile(join(this.dataDir, FILE_NAME), "utf8")) as {
				keys: Record<string, string>;
			};
			entries = new Map(Object.entries(raw.keys));
		} catch {
			// Nothing usable is saved.
		}
		this.entries = entries;
		return entries;
	}

	private async persist(entries: Map<string, string>): Promise<void> {
		await mkdir(this.dataDir, { recursive: true });
		const temporary = join(this.dataDir, `${FILE_NAME}.${randomUUID()}.tmp`);
		const body = JSON.stringify({ version: 1, keys: Object.fromEntries(entries) });
		try {
			await writeFile(temporary, body, { mode: 0o600 });
			await rename(temporary, join(this.dataDir, FILE_NAME));
		} catch (error) {
			await rm(temporary, { force: true });
			throw error;
		}
	}

	/** One write at a time, so two changes can't overwrite each other. */
	private enqueue<T>(task: () => Promise<T>): Promise<T> {
		const result = this.writes.then(task, task);
		this.writes = result.catch(() => undefined);
		return result;
	}

	private async readKey(providerId: string): Promise<string | undefined> {
		const stored = (await this.load()).get(providerId);
		if (!stored || !this.cipher || this.cipher.unavailableReason()) return undefined;
		try {
			return this.cipher.decrypt(Buffer.from(stored, "base64"));
		} catch {
			// Encrypted on another computer or account, so it can't be used here.
			console.warn(`The saved key for ${providerId} couldn't be decrypted.`);
			return undefined;
		}
	}

	save(providerId: string, key: string): Promise<void> {
		return this.enqueue(async () => {
			const reason = this.unavailableReason();
			if (reason || !this.cipher) throw new Error(reason);
			const entries = new Map(await this.load());
			entries.set(providerId, this.cipher.encrypt(key).toString("base64"));
			await this.persist(entries);
			this.entries = entries;
		});
	}

	remove(providerId: string): Promise<void> {
		return this.enqueue(async () => {
			const entries = new Map(await this.load());
			if (!entries.delete(providerId)) return;
			await this.persist(entries);
			this.entries = entries;
		});
	}

	async read(providerId: string): Promise<Credential | undefined> {
		if (await this.hasEnvironmentKey(providerId)) return undefined;
		const key = await this.readKey(providerId);
		return key ? { type: "api_key", key } : undefined;
	}

	async list(): Promise<readonly CredentialInfo[]> {
		return [...(await this.load()).keys()].map((providerId) => ({ providerId, type: "api_key" }));
	}

	async modify(
		providerId: string,
		fn: (current: Credential | undefined) => Promise<Credential | undefined>,
	): Promise<Credential | undefined> {
		const next = await fn(await this.read(providerId));
		if (next?.type === "api_key" && next.key) await this.save(providerId, next.key);
		return next;
	}

	delete(providerId: string): Promise<void> {
		return this.remove(providerId);
	}
}
