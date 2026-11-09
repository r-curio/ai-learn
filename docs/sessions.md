# How sessions are saved

Each chat is a folder under the data directory, beside a shared `session-index.sqlite`:

```text
sessions/<id>/
  session.jsonl     the log, and the source of truth
  summary.json      title, date, and chat type for the sidebar, can be rebuilt from the log
  attachments/      uploaded files, with a .json metadata file for each
```

The index copies each `summary.json` so the chat list doesn't read every folder. It's refreshed from the folders once per launch, and it's rebuilt if it's missing or damaged, so nothing may be stored only there.

It also holds each chat's visible text for search, built from what the learner sees and never from attachment files. A launch only rereads a log when its `updatedAt` differs from the one its text was indexed at. That read never repairs the log, because a reply may be saving at the same time. If a crash leaves a log ahead of its summary, the newest text isn't searchable until that chat next saves.

## The rules

1. **The log is append-only.** Each line is one record: a header, a message, a retry marker, or a tool change. Nothing is edited afterward. The only exception is trimming a last line that a crash cut short.
2. **Replies are stored exactly as the model sent them.** That includes reasoning data. Claude checks that earlier history hasn't changed, so a rewritten reply can lose that reasoning or cause a request to fail.
3. **Save first, then act.** The learner's message is flushed to disk before the model is called. Each reply and tool result is flushed before the next step starts.
4. **A session keeps its original system prompt.** The header stores it, so changing the prompt in a later version doesn't alter old conversations.
5. **Images are stored by reference.** The log points to the attachment file and restores the same data on load, which keeps logs small.
6. **A chat can change model on any turn.** Each saved reply already names the model that wrote it, so the log needs no record of the choice. Pi drops reasoning data when it sends a reply to a different model, and the log itself keeps it. The composer's choice is a preference, not part of the chat. API keys never enter the log.
7. **Timing sits beside a reply, not in it.** A reply's record can carry `workedMs`, how long the run had taken when its text started, because that moment can't be worked out afterward. It's never sent to the model. Older records don't have it, so the transcript estimates from saved timestamps when the reply has an Activity trace. Tool durations come from what Pi already saves on each tool result.

8. **A chat's type is set once, in the header.** Each message carries the learner's choice, because a first send can fail before anything is saved. The session only uses it while its log is empty, so later turns can't change it. Logs from before chat types have no value and count as Learning, so old logs stay byte-identical and need no version bump. `summary.json` and the index only copy it.
9. **How full a chat is comes from the log.** It's the input size in the last saved reply that reported one, against that reply's model limit, so nothing extra is saved and older chats work too. The composer shows the limit of the model it has selected, since that's where the next call goes.
10. **Citations stay inside the reply's text.** The tutor writes `<cite attachment="..." page="4">exact quote</cite>`, and the log keeps it as sent. The transcript removes any citation whose quote isn't on that page of the saved PDF text, and the UI shows the rest as "p. 4" links. Chats started before citations keep their old prompt, so they don't gain any.
11. **The open page is part of the message.** While a PDF is open in the attachment pane, a new message also carries `<viewing attachment="..." page="4" />` for the model. It's saved in the log and replayed with that turn, and `display` leaves it out, so the learner never sees it.
12. **A pending question is a tool call with no result.** The reply holding the `ask_question` call is saved and the run ends, so the log already shows that a question is waiting, and a reload leaves it alone. The answer is saved as that call's tool result before the model is called. Its record also keeps the answer as given, in `answer`. The model reads the result's text, which includes the learner's reasoning. The transcript shows only the answer and confidence. Older logs have no questions, so they stay byte-identical and need no version bump. Existing chats can use the tool on their next call. See [ADR 0010](adr/0010-a-pending-question-is-an-unanswered-tool-call.md).
13. **A change in the tutor's tools is saved where it happened.** Pi tells the model about new or removed tools, like `web_search` once a search key is added, with a system message in the history. The session works out that message itself before each run, and saves it as a `tools` record before the learner's message, or after an answer, since nothing may come between a tool call and its result. Pi then sees no change and adds nothing. On reload the record goes back in the same place, so a reopened chat sends the same history it sent live. The first system message, with the prompt and the tools every chat starts with, isn't saved and is rebuilt on each load. Older logs have no `tools` records, so they stay byte-identical and need no version bump.

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
| App killed while a question waits   | Nothing changes. The question reappears on reload and can still be answered.                                           |
| App killed after an answer          | The answer is kept. The chat shows Retry, and the learner doesn't answer again.                                        |
| Crash during a write                | The cut-off last line is trimmed on reload.                                                                            |
| Damage elsewhere in the log         | The chat refuses to open and says why. It is never silently repaired.                                                  |
| The model returns an error          | The failure stays in the log and shows Retry. A retry marker hides it afterward, and Pi doesn't resend it.             |
| The learner presses Stop            | The partial reply stays visible, marked as stopped. Pi doesn't send it to the model again.                             |

## Not built yet

- **Compaction:** long sessions keep their full history. The current model has a 1M token context window, so this can wait until real sessions show it's needed.
- **Resuming a live reply:** closing or reloading the window during a reply stops that reply.
- **Cleaning up unsent uploads:** files attached to a chat that never sent a message stay on disk.
