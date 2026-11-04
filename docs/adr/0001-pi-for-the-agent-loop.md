# Use Pi for the agent loop and model access

We use `pi-agent-core` and `pi-ai` rather than writing the loop ourselves or using a larger framework. The project exists partly to learn harness engineering, so the harness design should stay ours, while streaming, tool execution, and provider differences are handled by a library. Pi exposes the points we want to design around, such as turn endings, request preparation, and custom message handling.

## Considered options

- **Vercel AI SDK:** it has the best ready-made chat UI tooling, but leaves less of the harness exposed. We build our own streaming bridge and chat state to use Pi instead.
- **Mastra:** it bundles agents, workflows, memory, and evals, but it's the largest option and makes more of the design decisions we want to make ourselves.
- **LangGraph.js:** it has explicit graphs and checkpoints, but is heavier to learn, and a paused step reruns from its start when resumed.
- **`pi-durable`:** it would handle saved sessions, but it's marked experimental with API changes between releases, and it would take over the part we most want to design. See [ADR 0003](0003-append-only-session-log.md).

## Consequences

Pi moves quickly, so versions are pinned and upgraded deliberately. There's also no Pi web UI package to lean on, so the UI layer is ours to maintain.
