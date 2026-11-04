# Prefer proof in pull requests over unit tests

Every change is shown working in a real run, with the evidence posted as a pull request comment. Automated tests are kept only where a failure would be silent or costly: saved history, crash recovery, security checks, and file parsing. Proof catches what tests miss, like the blank page that only appeared when running the real app, but it only shows that something worked once, so a few tests stay as a safety net. Those tests caught a lost system prompt that would have been easy to miss by hand.

## Consequences

Regressions outside the tested areas are only noticed when someone runs that part of the app, so proof has to cover what a change could affect. Real model runs also cost money, which is why `AGENTS.md` sets a budget per pull request.
