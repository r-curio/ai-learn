# Diagrams are described by the tutor and laid out by the app

The tutor draws with two tools, `draw` and `plan`. It describes boxes, arrows and groups, never positions. The harness lays them out with elkjs and saves the positions in the tool result's `details`, and the UI turns that saved layout into an Excalidraw drawing. A reopened chat shows exactly what was drawn, because nothing is laid out again. The cost is a layout library in the harness, and a drawing format of our own between the model and Excalidraw.

The model gets a one-line result and never sees positions. A plan is laid out upward, from foundations to the goal, and always has the id `plan`, so a chat has one. Drawing again with the same id makes a new version, counted in transcript order.

## Considered options

- **The model writes coordinates or Excalidraw elements:** models place things badly, overlap labels, and spend many tokens on numbers.
- **The model writes Mermaid:** Excalidraw can import it, but the import supports only some diagram types, and its output can change between versions, so a saved chat could look different later.
- **Lay out again on every load:** less to save, but an elkjs update could move boxes in old chats, and the learner's edits in a later change need fixed positions to compare against.
- **dagre instead of elkjs:** smaller, but it handles groups less well and is barely maintained. elkjs is EPL-2.0, which allows use in this MIT app.

Excalidraw always lists its own CDN as a fallback for its fonts. The app serves the fonts itself, and the content security policy blocks the CDN, so no request leaves the computer.

[How sessions are saved](../sessions.md) has the rule for drawings.
