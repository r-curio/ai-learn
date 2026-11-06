# Architecture

ai-learn is a desktop app with three layers that only talk through defined boundaries. The learner's data stays on their computer, while messages and attachments go to the model provider to generate replies.

```text
Electron window (electron/)
  loads the UI from the local server, and has no direct access to the harness
        │
        ▼
React UI (src/web/)
  chat, composer, and sidebar
        │  HTTP on 127.0.0.1, with a per-launch token
        │  replies stream back as server-sent events
        ▼
Local server (src/server/)
  routes, auth, and streaming
        │  function calls
        ▼
Harness (src/harness/)
  sessions, attachments, tools, and the engine
        │                         │
        ▼                         ▼
Files and SQLite index       Model provider, through Pi
```

`src/shared/` holds the event and view types used by both the server and the UI. `CONTRIBUTING.md` lists which folders may import which, and `npm run check:deps` enforces it.

## One turn, start to finish

1. The UI uploads any attachments as soon as the learner adds them. The server identifies each file by its contents, and rejects anything unsupported.
2. The learner sends a message, and the server hands it to the session.
3. The session saves the message to the session log before calling the model.
4. Pi runs the model and any tools. Text streams to the UI as it arrives, and each finished reply and tool result is saved before the next step starts.
5. If the tutor asks a question, the run ends there. The learner's answer is saved, and a new run continues the same turn.
6. When the run ends, the UI replaces its streamed copy with the server's transcript, which is built from the log.

## Where things live

| Mode             | Data folder                             | Started with      |
| ---------------- | --------------------------------------- | ----------------- |
| Desktop app      | Electron's user data folder for the app | `npm run desktop` |
| Browser dev mode | `data/` in the repo, which git ignores  | `npm run dev`     |

Both modes keep session logs as plain files. The session index, a SQLite file beside them, serves the chat list and can always be rebuilt from them.

Preferences live in `preferences.json` in the same folder. The desktop app's server gets a new port on each launch, and browser storage is tied to the port, so anything that must last between launches goes through the server.

[How sessions are saved](sessions.md) covers the session log and crash recovery in detail.

## Security boundaries

- **Local server:** it listens only on `127.0.0.1`, requires a secret token created at each launch, and rejects requests aimed at other hostnames. Other programs on the computer can reach the port, so the token is what protects it.
- **Attachments:** their contents are marked as material to work with, not as instructions to the tutor. Prompt injection is still possible, because that marking only guides the model.
- **PDFs:** pdf.js draws pages to canvases in a worker, under the same content security policy as the app. Links, forms, and scripts inside a PDF aren't rendered or run.
- **Electron window:** the page has no Node access, runs sandboxed, and can't navigate away from the local server. Web links open in the system browser.

## Not built yet

These are planned in the roadmap and aren't part of the current architecture:

- The teaching engine (#5)
- Two-way diagrams (#6)
- Knowledge memory across sessions (#7)

## Decisions

Decision records in [`docs/adr/`](adr/) explain why the app is built this way.
