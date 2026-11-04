import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import type { SessionSummary } from "../shared/protocol.ts";
import type { Engine } from "./engine.ts";
import { readSummary, Session, SessionBusyError } from "./session.ts";

const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Finds, opens, and deletes sessions in the data folder. */
export class SessionStore {
	private readonly open = new Map<string, Session>();

	constructor(
		private readonly engine: Engine,
		private readonly dataDir: string,
	) {}

	create(): Session {
		const session = new Session(this.engine, this.dataDir);
		this.open.set(session.id, session);
		return session;
	}

	/** Returns undefined if no such session exists. Throws if it exists but can't be read. */
	async get(id: string): Promise<Session | undefined> {
		if (!SESSION_ID.test(id)) return undefined;
		const existing = this.open.get(id);
		if (existing) return existing;
		try {
			const session = await Session.load(this.engine, this.dataDir, id);
			this.open.set(id, session);
			return session;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
			throw error;
		}
	}

	async list(): Promise<SessionSummary[]> {
		const ids = await readdir(join(this.dataDir, "sessions")).catch(() => [] as string[]);
		const summaries = await Promise.all(
			ids.filter((id) => SESSION_ID.test(id)).map((id) => readSummary(this.engine, this.dataDir, id)),
		);
		return summaries.filter((summary) => summary !== undefined).sort((a, b) => b.updatedAt - a.updatedAt);
	}

	async delete(id: string): Promise<boolean> {
		const session = await this.get(id);
		if (!session) return false;
		if (session.isRunning) throw new SessionBusyError();
		this.open.delete(id);
		await rm(join(this.dataDir, "sessions", id), { recursive: true, force: true });
		return true;
	}
}
