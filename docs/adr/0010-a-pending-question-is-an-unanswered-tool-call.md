# Save a pending question as a tool call with no result

When the tutor asks a question, the reply holding the `ask_question` call is saved and the run ends. The learner's answer becomes that call's tool result, and the run then continues. Waiting has no record of its own, because the log's last reply already shows it, so a crash at any moment leaves a question that can still be answered. The cost is that a tool call can now stay unanswered in a log for as long as the learner takes, and the code that settles interrupted tools has to leave this one alone.

Pi still expects every tool to return a result, so the tool returns a placeholder that's never saved and is removed from memory when the run ends.

## Considered options

- **Keep the tool waiting inside the run:** this is the simplest code, but closing the window stops a run, so the question wouldn't survive a reload or a crash.
- **Save the placeholder, and send the answer as a learner message:** every tool call would have a result, but a crash just after the reply would turn the question into an error, and the model would read an answer that isn't attached to its question.

[How sessions are saved](../sessions.md) has the rules and failure cases.
