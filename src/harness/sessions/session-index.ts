import { mkdirSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import type { SearchResult, SessionSummary } from "../../shared/protocol.ts";
import { MATCH_END, MATCH_START, snippetParts, stripMatchMarkers } from "./session-search.ts";

const SCHEMA = `CREATE TABLE IF NOT EXISTS sessions (
	id TEXT PRIMARY KEY,
	title TEXT NOT NULL,
	updated_at INTEGER NOT NULL
)`;

/** `updated_at` is the summary date the text was indexed at, so a launch can skip unchanged chats. */
const SEARCH_SCHEMA = `CREATE VIRTUAL TABLE IF NOT EXISTS session_search USING fts5(
	session_id UNINDEXED,
	updated_at UNINDEXED,
	title,
	body
)`;

/** Long enough for the words around a match, short enough to keep it on the sidebar's one line. */
const SNIPPET_TOKENS = 8;

function open(path: string): DatabaseSync {
	const db = new DatabaseSync(path);
	try {
		db.exec(SCHEMA);
		db.exec(SEARCH_SCHEMA);
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
		this.removeText(id);
	}

	removeText(id: string): void {
		this.db.prepare("DELETE FROM session_search WHERE session_id = ?").run(id);
	}

	/** Replace what search knows about a chat. */
	setText(summary: SessionSummary, body: string): void {
		this.transaction(() => {
			this.removeText(summary.id);
			this.db
				.prepare(
					"INSERT INTO session_search (session_id, updated_at, title, body) VALUES (?, ?, ?, ?)",
				)
				.run(summary.id, summary.updatedAt, summary.title, stripMatchMarkers(body));
		});
	}

	/** The summary date each chat's text was indexed at. */
	textVersions(): Map<string, number> {
		const rows = this.db
			.prepare("SELECT session_id, updated_at FROM session_search")
			.all() as unknown as { session_id: string; updated_at: number }[];
		return new Map(rows.map((row) => [row.session_id, row.updated_at]));
	}

	/** Takes a query from `toFtsQuery`. The join leaves out text for a chat that's since been removed. */
	search(ftsQuery: string): SearchResult[] {
		const rows = this.db
			.prepare(
				`SELECT s.id, s.title, s.updated_at,
					snippet(session_search, 3, ?, ?, '…', ${SNIPPET_TOKENS}) AS snippet
				FROM session_search CROSS JOIN sessions s ON s.id = session_search.session_id
				WHERE session_search MATCH ?
				ORDER BY bm25(session_search, 0, 0, 5, 1), s.updated_at DESC`,
			)
			.all(MATCH_START, MATCH_END, ftsQuery) as unknown as {
			id: string;
			title: string;
			updated_at: number;
			snippet: string;
		}[];
		return rows.map((row) => ({
			id: row.id,
			title: row.title,
			updatedAt: row.updated_at,
			snippet: snippetParts(row.snippet),
		}));
	}

	private transaction(work: () => void): void {
		this.db.exec("BEGIN");
		try {
			work();
			this.db.exec("COMMIT");
		} catch (error) {
			this.db.exec("ROLLBACK");
			throw error;
		}
	}

	/** Replace everything with what the session folders say. */
	replaceAll(summaries: SessionSummary[]): void {
		this.transaction(() => {
			this.db.exec("DELETE FROM sessions");
			for (const summary of summaries) this.upsert(summary);
		});
	}

	list(): SessionSummary[] {
		const rows = this.db
			.prepare("SELECT id, title, updated_at FROM sessions ORDER BY updated_at DESC")
			.all() as unknown as { id: string; title: string; updated_at: number }[];
		return rows.map((row) => ({ id: row.id, title: row.title, updatedAt: row.updated_at }));
	}
}
