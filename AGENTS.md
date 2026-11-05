# ai-learn

A local-first AI learning app. It's an Electron app with a local server and an agent harness built on Pi.

## Before changing code

- Every change ships through an issue, a branch, and a pull request. The owner merges. `/lfg <issue>` runs those steps.
- Read `CONTRIBUTING.md` before opening a PR or adding files, folders, or tests. It holds the size limits, import rules, proof requirements, and testing policy.
- Read `docs/sessions.md` before changing how sessions are saved or replayed.
- Read `docs/architecture.md` before changing how the layers connect.
- Check `docs/adr/` before reversing a recorded decision, and add a record for a new decision that is hard to reverse, surprising, and a real trade-off.
- Use the terms in `GLOSSARY.md` in code, docs, and PRs, and update it when a term is settled.

## Codebase structure

- **Folders:** `src/shared` imports nothing from the app, `src/harness` imports only `shared`, `src/server` imports `harness` and `shared`, and `src/web` imports only `shared`.
- **Files:** aim for up to 200 lines. Over 300 needs explaining in the PR, and over 400 is blocked.
- **Functions:** aim for up to 40 lines. Over 60 needs explaining in the PR.
- **Subfolders:** create one when 3 or more files share a concept, named after that concept. Aim for up to 8 files in a folder, and over 15 is blocked. Aim for 2 levels below `src/`, and 4 is blocked.

`CONTRIBUTING.md` holds the full rules.

Skills live in `.agents/skills/`, and `.claude/skills` links to that folder.

## Rules with no tooling behind them

- Treat saved session history as immutable. Replies replay byte-identical, so changes to what's sent for old turns need a log version bump.
- Treat the session index as disposable. It's rebuilt from the session folders, so anything new must be saved in the log or another source first.
- Keep model and API keys in `.env.local`, which git ignores.
- Prove behavior with a real run before calling it done. Real model runs cost money, so stay under about $0.50 per PR unless the owner agrees to more.
