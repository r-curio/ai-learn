# Use Electron for the desktop app

The harness and server are Node code, and Electron runs Node without any extra packaging. It also renders with the same Chromium on every platform, so diagrams and streaming only need testing on one browser engine. That keeps attention on the teaching harness, and accepts a larger download and higher memory use.

## Considered options

- **Tauri:** it has a smaller shell and an explicit permissions model, and would have been a chance to learn some Rust. It would also require packaging Node as a sidecar, managing that process ourselves, and testing on both WebKit and Chromium.
- **Browser only:** it's the simplest option, but learners would have to run a server and keep a browser tab open.
