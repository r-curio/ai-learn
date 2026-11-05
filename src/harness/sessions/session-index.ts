import { mkdirSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import type { SessionSummary } from "../../shared/protocol.ts";

const SCHEMA = `CREATE TABLE IF NOT EXISTS sessions (
	id TEXT PRIMARY KEY,
	title TEXT NOT NULL,
	updated_at INTEGER NOT NULL
)`;

function open(path: string): DatabaseSync {
	const db = new DatabaseSync(path);
	try {
		db.exec(SCHEMA);
		return db;
	} catch (error) {
		db.close();
		throw error;
	}
}

/**
 * A SQLite copy of each session's summary, so the sidebar needn't read every folder.
 * The session folders stay the source of truth: this file can be deleted and rebuilt at any time.
 */
export class SessionIndex {
	private readonly db: DatabaseSync;

	constructor(dataDir: string) {
		mkdirSync(dataDir, { recursive: true });
		const path = join(dataDir, "session-index.sqlite");
		try {
			this.db = open(path);
		} catch {
			// A damaged index holds nothing that can't be rebuilt, so start a new one.
			rmSync(path, { force: true });
			rmSync(`${path}-journal`, { force: true });
			this.db = open(path);
		}
	}

	upsert(summary: SessionSummary): void {
		this.db
			.prepare(
				`INSERT INTO sessions (id, title, updated_at) VALUES (?, ?, ?)
				ON CONFLICT (id) DO UPDATE SET title = excluded.title, updated_at = excluded.updated_at`,
			)
			.run(summary.id, summary.title, summary.updatedAt);
	}

	remove(id: string): void {
		this.db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
	}

	/** Replace everything with what the session folders say. */
	replaceAll(summaries: SessionSummary[]): void {
		this.db.exec("BEGIN");
		try {
			this.db.exec("DELETE FROM sessions");
			for (const summary of summaries) this.upsert(summary);
			this.db.exec("COMMIT");
		} catch (error) {
			this.db.exec("ROLLBACK");
			throw error;
		}
	}

	list(): SessionSummary[] {
		const rows = this.db
			.prepare("SELECT id, title, updated_at FROM sessions ORDER BY updated_at DESC")
			.all() as unknown as { id: string; title: string; updated_at: number }[];
		return rows.map((row) => ({ id: row.id, title: row.title, updatedAt: row.updated_at }));
	}
}
