# Learning chats run a prober, then a teacher

A Learning chat's system prompt has two phases. The prober measures the learner's goal and what they already understand, and calls `finish_probe` with the result. The teacher then plans from that result and teaches one step at a time. Each phase is the shared prompt plus its own segments, written as Markdown files in `src/harness/prompts/`. The ideas come from LearnHarness's teaching method, rewritten in our own words, because LearnHarness is AGPL and ai-learn is MIT.

The phase is a named section of the system prompt, a feature Pi already has. The first system message holds the shared text and the prober's section. After a successful `finish_probe`, one later system message replaces that section with the teacher's and removes the tool. That message is saved where it was sent, like any change of tools, so a reopened chat sends the same history. Both phase prompts are saved in the header when the chat starts, so a chat that switches after an update still gets the teacher it started with.

This changes what the header holds, so the log version goes from 1 to 2. An older app refuses a version 2 log, rather than sending only the shared text. Version 1 logs, and Practice chats, keep a single prompt with no phases.

## Considered options

- **Replace the first system message on the switch:** the earlier turns would then have been sent under a different prompt from the one they were written under.
- **A new record type for the phase:** this would add a second way of saving a system prompt change, when the `tools` record already saves one exactly as sent.
- **Save only the switch, and take the teacher's prompt from the app:** less to save, but a chat that probed on one version and taught on the next would mix prompts from two versions.
- **One prompt for the whole lesson:** simpler, but the prober's job of measuring and the teacher's job of planning and teaching pull in different directions, and both prompts are long.

[How sessions are saved](../sessions.md) has the rule for phases.
