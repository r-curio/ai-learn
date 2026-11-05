import { readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import type { SessionSummary } from "../../shared/protocol.ts";
import type { Engine } from "../engine.ts";
import { Session, SessionBusyError } from "./session.ts";
import { SessionIndex } from "./session-index.ts";

const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Read a saved summary, or rebuild it if a crash left it missing. */
async function readSummary(
	engine: Engine,
	dataDir: string,
	id: string,
): Promise<SessionSummary | undefined> {
	try {
		return JSON.parse(
			await readFile(join(dataDir, "sessions", id, "summary.json"), "utf8"),
		) as SessionSummary;
	} catch {
		try {
			const session = await Session.load(engine, dataDir, id);
			return session.hasContent ? { ...session.summary(), updatedAt: 0 } : undefined;
		} catch {
			return undefined;
		}
	}
}

/** Finds, opens, and deletes sessions in the data folder. */
export class SessionStore {
	private readonly open = new Map<string, Session>();
	private readonly index: SessionIndex;
	private synced?: Promise<void>;

	constructor(
		private readonly engine: Engine,
		private readonly dataDir: string,
	) {
		this.index = new SessionIndex(dataDir);
	}

	/** Keep the index current as a session saves. A failed index write must never fail a reply. */
	private track(session: Session): Session {
		session.onSummary = (summary) => {
			try {
				this.index.upsert(summary);
			} catch (error) {
				console.error(error);
			}
		};
		this.open.set(session.id, session);
		return session;
	}

	create(): Session {
		return this.track(new Session(this.engine, this.dataDir));
	}

	/** Returns undefined if no such session exists. Throws if it exists but can't be read. */
	async get(id: string): Promise<Session | undefined> {
		if (!SESSION_ID.test(id)) return undefined;
		const existing = this.open.get(id);
		if (existing) return existing;
		try {
			return this.track(await Session.load(this.engine, this.dataDir, id));
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
			throw error;
		}
	}

	/** Bring the index in line with the session folders, which may have changed since last launch. */
	private async sync(): Promise<void> {
		const ids = await readdir(join(this.dataDir, "sessions")).catch(() => [] as string[]);
		const summaries = await Promise.all(
			ids
				.filter((id) => SESSION_ID.test(id))
				.map((id) => readSummary(this.engine, this.dataDir, id)),
		);
		this.index.replaceAll(summaries.filter((summary) => summary !== undefined));
	}

	async list(): Promise<SessionSummary[]> {
		this.synced ??= this.sync().catch((error: unknown) => {
			this.synced = undefined;
			throw error;
		});
		await this.synced;
		return this.index.list();
	}

	async delete(id: string): Promise<boolean> {
		const session = await this.get(id);
		if (!session) return false;
		if (session.isRunning) throw new SessionBusyError();
		this.open.delete(id);
		await rm(join(this.dataDir, "sessions", id), { recursive: true, force: true });
		this.index.remove(id);
		return true;
	}
}
