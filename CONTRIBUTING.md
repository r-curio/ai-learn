# Contributing

## How work happens

1. **Start with an issue** that says what's being done and what "done" looks like.
2. **Create a branch** for one concern, named like `feat/split-app` or `fix/pdf-upload`.
3. **Open a PR** using the template. Aim for under about 400 changed lines. Formatting-only commits don't count.
4. **Post proof** as a PR comment.
5. **The owner merges** with a squash once checks pass and the change is reviewed.

## Proof

Proof comes from an actual run, with the exact commands and their output. Remove secrets first.

| Change                    | Proof in the PR comment                                                             |
| ------------------------- | ----------------------------------------------------------------------------------- |
| UI                        | Screenshot or recording from the real app, including changed empty and error states |
| Harness or model behavior | A real run: what was sent, the result, and the cost                                 |
| Bug fix                   | The failure before and the working result after                                     |
| Refactor                  | Same behavior before and after, listing what was exercised                          |
| Docs or config            | The command output, or nothing for plain text                                       |

To add an image, run `scripts/publish-proof.sh <pr-number> <image-file>` and paste the Markdown it prints. Images on the `proof-assets` branch are public and stay in the repo's history.

## Testing policy

Proof is the default. Add an automated test only where a failure would be silent or costly:

- Saved history and replay
- Crash recovery
- Security checks
- File parsing

Tests use the scripted fake model and need no network or API key.

## File and function size

One clear purpose per file matters more than the count. `npm run check:structure` and ESLint enforce these limits.

| Limit      | Files     | Functions | What happens                   |
| ---------- | --------- | --------- | ------------------------------ |
| Target     | Up to 200 | Up to 40  | Normal                         |
| Warning    | Over 300  | Over 60   | Explain it in the PR, or split |
| Hard limit | Over 400  | None      | The commit is blocked          |

Test files are exempt from the hard limit.

## Folders

Create a subfolder when any of these is true:

- 3 or more files belong to one concept, like `log`, `session`, and `transcript`
- Files repeat a name prefix, like `quiz-card`, `quiz-state`, and `quiz-score`
- A folder passes 8 files and has a natural group to move out

Keep 1–2 related files in the parent until a third arrives, unless a framework requires a folder. Name folders after a concept, like `pdf/` or `sessions/`, and add them once their files exist.

| Limit      | Files directly in a folder | Total lines in those files | Levels below `src/` | What happens                        |
| ---------- | -------------------------- | -------------------------- | ------------------- | ----------------------------------- |
| Target     | Up to 8                    | Up to 1,000                | 2                   | Normal                              |
| Warning    | Over 10                    | Over 1,500                 | 3                   | Explain it in the PR, or reorganize |
| Hard limit | Over 15                    | None                       | 4                   | The commit is blocked               |

Files in a subfolder count toward that subfolder, not its parent. `tests/fixtures` and generated files are exempt, and `tests/` is exempt from the line total.

## Where code goes

| Path           | Holds                                         | May import           |
| -------------- | --------------------------------------------- | -------------------- |
| `src/shared/`  | Types and helpers used by the server and UI   | Nothing from the app |
| `src/harness/` | The agent harness, with no server or UI       | `shared`             |
| `src/server/`  | The local HTTP server                         | `harness`, `shared`  |
| `src/web/`     | The React UI, which uses the server over HTTP | `shared`             |
| `electron/`    | The desktop shell only                        | Built server output  |
| `tests/`       | High-risk behavior only                       | Anything             |

`npm run check:deps` enforces these rules and blocks circular imports.

## UI styling and components

We follow the [Next.js guidance](https://nextjs.org/docs/app/getting-started/css) on CSS.

- **Tailwind classes** are the default for styling. Colours come only from the tokens in `src/web/globals.css`, and the default palette is switched off.
- **`src/web/globals.css`** is the only global stylesheet, imported once in `main.tsx`. Add to it only what applies to the whole app.
- **CSS Modules** (`name.module.css`) are for what classes can't reach, like Markdown output.

Put a component in `src/web/components/` when more than one feature could use it and it knows nothing about any feature. Everything else stays in its feature folder, like `chat/` or `composer/`.

Use a [shadcn/ui](https://ui.shadcn.com) primitive when one fits, and add it with `npx shadcn add <name>`. Those files keep shadcn's lowercase names, like `button.tsx`, and our own components are PascalCase, like `Notice.tsx`. After adding one:

- Swap any Tailwind palette colour, like `bg-white`, for a token. The palette is off, so these render with no colour and no error.
- Don't re-add a component that's already here, since that overwrites our edits to it. `cn` from the `cn` package merges classes.
- Pin any new dependency to an exact version.

## Tools

Run everything CI runs with `npm run check`. Hooks install with `npm install`.

- **Pre-commit:** format, lint, scan for secrets, and check structure on what's staged.
- **Pre-push:** type check and import rules.
- **GitHub:** all of the above, plus the build and tests. These are what protect `main`, since local hooks can be skipped.

`gitleaks` is installed separately, with `brew install gitleaks`. Without it, the local hook skips the scan and CI still runs it.
