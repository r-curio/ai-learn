# How sessions are saved

Each chat is a folder under the data directory, beside a shared `session-index.sqlite`:

```text
sessions/<id>/
  session.jsonl     the log, and the source of truth
  summary.json      title and date for the sidebar, can be rebuilt from the log
  attachments/      uploaded files, with a .json metadata file for each
```

The index copies each `summary.json` so the chat list doesn't read every folder. It's refreshed from the folders once per launch, and it's rebuilt if it's missing or damaged, so nothing may be stored only there.

## The rules

1. **The log is append-only.** Each line is one record: a header, a message, or a retry marker. Nothing is edited afterward. The only exception is trimming a last line that a crash cut short.
2. **Replies are stored exactly as the model sent them.** That includes reasoning data. Claude checks that earlier history hasn't changed, so a rewritten reply can lose that reasoning or cause a request to fail.
3. **Save first, then act.** The learner's message is flushed to disk before the model is called. Each reply and tool result is flushed before the next step starts.
4. **A session keeps its original system prompt.** The header stores it, so changing the prompt in a later version doesn't alter old conversations.
5. **Images are stored by reference.** The log points to the attachment file and restores the same data on load, which keeps logs small.
6. **A chat can change model on any turn.** Each saved reply already names the model that wrote it, so the log needs no record of the choice. Pi drops reasoning data when it sends a reply to a different model, and the log itself keeps it. The composer's choice is a preference, not part of the chat. API keys never enter the log.

## Three views of one log

| View                  | Used by             | Built in                                     |
| --------------------- | ------------------- | -------------------------------------------- |
| The saved record      | Reloading a session | `src/harness/sessions/log.ts`                |
| What the model sees   | Each model request  | `Session.load`, then Pi's message conversion |
| What the learner sees | The chat UI         | `src/harness/sessions/transcript.ts`         |

For example, a message with a PDF is one long block of text for the model, but the learner sees only what they typed and a file chip. One learner turn can also span several model calls, which the UI shows as a single reply.

## What happens when something goes wrong

| Situation                           | Result                                                                                                                 |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| App killed before or during a reply | The learner's message is kept. A partial reply is lost, because replies are saved when complete. The chat shows Retry. |
| App killed while a tool runs        | The tool gets an error result on reload and is never rerun automatically, since it may have partly finished.           |
| Crash during a write                | The cut-off last line is trimmed on reload.                                                                            |
| Damage elsewhere in the log         | The chat refuses to open and says why. It is never silently repaired.                                                  |
| The model returns an error          | The failure stays in the log and shows Retry. A retry marker hides it afterward, and Pi doesn't resend it.             |
| The learner presses Stop            | The partial reply stays visible, marked as stopped. Pi doesn't send it to the model again.                             |

## Not built yet

- **Compaction:** long sessions keep their full history. The current model has a 1M token context window, so this can wait until real sessions show it's needed.
- **Resuming a live reply:** closing or reloading the window during a reply stops that reply.
- **Cleaning up unsent uploads:** files attached to a chat that never sent a message stay on disk.
