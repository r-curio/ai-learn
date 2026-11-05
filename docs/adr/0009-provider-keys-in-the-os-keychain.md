# Keep provider keys encrypted with the operating system's keychain

Learners add API keys in Settings, so keys can no longer live only in `.env.local`, which a packaged app doesn't have. We'll encrypt saved keys with Electron's `safeStorage` and keep the encrypted file in the app's data folder. `safeStorage` uses the system's keychain, so another program or a copied data folder can't simply read the keys. We rejected a plain file because it leaves keys readable on disk, and the Settings screen promises that keys stay on the learner's computer.

## Consequences

The window has no Node access, so a key travels from the UI to the local server, which uses it and never sends it back. The UI only learns whether a provider is connected.

`safeStorage` needs Electron, so browser dev mode keeps reading `.env.local`, and an environment variable wins over a saved key. Linux without a keychain has no real encryption, and the app must say so rather than save the key silently.

The Settings screen is built, but saving isn't: until it is, its keys are thrown away. `AGENTS.md` should change its rule on keys when saving lands.
