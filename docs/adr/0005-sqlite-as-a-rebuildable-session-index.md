# Add SQLite as a rebuildable index beside the session logs

We keep a SQLite file, `session-index.sqlite`, that copies each session's summary for the chat list. The session folders stay the source of truth, as [ADR 0003](0003-append-only-session-log.md) requires: the index is refreshed from them once per launch, and a missing or damaged index is rebuilt without the learner noticing. This gives search and knowledge memory a place to add queries later, at the cost of a second copy of the summaries that has to be kept in step.

## Considered options

- **Move the session logs into SQLite:** it would allow queries over everything, but it gives up readable files and simple crash recovery, and it risks changing the stored replies that must stay byte-identical.
- **No database yet:** it's simpler, and a plain scan is enough for today's chat list. We chose to add the index now rather than when search or memory first needs it.
- **`better-sqlite3`:** it's mature, but it's a native package that has to be rebuilt for Electron. `node:sqlite` is built in and works in Electron 45, including full-text search, though Node still marks it as experimental in some versions.

## Consequences

Nothing may be stored only in the index, because it can be deleted at any time.
