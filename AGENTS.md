# ai-learn

A local-first AI learning app. It's an Electron app with a local server and an agent harness built on Pi.

## Before changing code

- Every change ships through an issue, a branch, and a pull request. The owner merges.
- Read `CONTRIBUTING.md` before opening a PR or adding files, folders, or tests. It holds the size limits, import rules, proof requirements, and testing policy.
- Read `docs/sessions.md` before changing how sessions are saved or replayed.

## Codebase structure

- **Folders:** `src/shared` imports nothing from the app, `src/harness` imports only `shared`, `src/server` imports `harness` and `shared`, and `src/web` imports only `shared`.
- **Files:** aim for up to 200 lines. Over 300 needs explaining in the PR, and over 400 is blocked.
- **Functions:** aim for up to 40 lines. Over 60 needs explaining in the PR.
- **Subfolders:** create one when 3 or more files share a concept, named after that concept. Aim for up to 8 files in a folder, and over 15 is blocked. Aim for 2 levels below `src/`, and 4 is blocked.

`CONTRIBUTING.md` holds the full rules.

## Rules with no tooling behind them

- Treat saved session history as immutable. Replies replay byte-identical, so changes to what's sent for old turns need a log version bump.
- Keep model and API keys in `.env.local`, which git ignores.
- Prove behavior with a real run before calling it done. Real model runs cost money, so stay under about $0.50 per PR unless the owner agrees to more.
