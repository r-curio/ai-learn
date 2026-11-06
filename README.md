# ai-learn

A local-first AI learning app. You chat with a tutor, attach your own material, and work through hard topics on your own computer.

> **Status: early development.** Milestones 1 and 2 of 5 are done: a working chat with streaming, tools, file uploads, and saved sessions. The teaching engine isn't built yet, so today it behaves like a general tutor chat.

## What works today

- Streaming replies from the model you choose, with a Stop button
- Attach images, PDFs, and text files with the button, drag and drop, or paste
- A tool that lets the model read long attachments in parts
- Saved chats you can reopen, continue, and delete
- Crash recovery, with a Retry button for failed or interrupted replies
- Running token and cost totals
- A desktop app (Electron) and a browser dev mode
- A free fake model for trying the app and running tests without an API key

## Run it

You need Node 22.19 or newer and an API key for a model provider, such as [Anthropic](https://console.anthropic.com/). API usage is billed by that provider.

```bash
npm install
cp .env.example .env.local   # for browser dev mode, add a key such as ANTHROPIC_API_KEY
npm run desktop              # builds and opens the desktop app
```

Other commands:

```bash
npm run dev         # browser dev mode. Open the link it prints
npm test            # no API key or network needed
npm run typecheck
AI_LEARN_FAKE_MODEL=1 npm run desktop   # try it for free with the fake model
```

## Privacy

API keys you add in Settings are encrypted with your computer's keychain and only sent to their provider. Your files and the app's data stay on your computer, but your messages and attachments are sent to the provider of the model you choose to generate replies. The local server only listens on `127.0.0.1` and requires a secret token created at each launch.

## Current limits

- Closing the window during a reply stops that reply.
- Images must be 5 MB or smaller.
- Scanned PDFs without a text layer aren't supported.
- There's no packaged installer yet, so you run it from source.

## How it's organized

| Path           | What it does                                                                        |
| -------------- | ----------------------------------------------------------------------------------- |
| `src/harness/` | The agent harness: model engine, sessions, saved log, index, tools, and attachments |
| `src/server/`  | Local HTTP server that streams events to the UI                                     |
| `src/web/`     | React chat UI                                                                       |
| `src/shared/`  | Types shared by the server and UI                                                   |
| `electron/`    | Desktop shell                                                                       |

It's built on [Pi](https://github.com/earendil-works/pi) for the agent loop and model access.

Read more in the [architecture overview](docs/architecture.md), [how sessions are saved](docs/sessions.md), the [glossary](GLOSSARY.md), and the [decision records](docs/adr/).

## Roadmap

1. ~~Chat, streaming, tools, and uploads~~
2. ~~Saved sessions that survive crashes and can resume~~
3. Teaching engine: measure what you know, plan, teach, and practice
4. Two-way Excalidraw diagrams that you and the tutor can both edit
5. Knowledge memory across sessions, with a graph view

## License

[MIT](LICENSE)
