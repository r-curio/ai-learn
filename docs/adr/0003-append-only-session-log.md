# Store each session as an append-only log of plain files

Each session is a JSONL file that's only ever added to, with model replies stored exactly as received. Claude checks that earlier history hasn't changed, so rewriting a reply can lose its reasoning data or cause a request to fail. An append-only log also makes crash recovery simple, and leaves learners with files they can read. The cost is that compaction can't work by editing old turns, so it will need its own design when real sessions need it.

## Considered options

- **SQLite:** it has better querying and handles concurrent access, but it isn't readable without tools, and nothing we do today needs queries. A single app instance writes each log.
- **`pi-durable`:** see [ADR 0001](0001-pi-for-the-agent-loop.md).

[How sessions are saved](../sessions.md) has the rules and failure cases.
