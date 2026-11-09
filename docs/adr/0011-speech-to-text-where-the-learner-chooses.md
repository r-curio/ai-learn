# Turn speech into text where the learner chooses, without shipping a model

Voice input needs something to turn a recording into text. The learner chooses: a cloud provider with their own key (OpenAI, Groq, Deepgram or NVIDIA's hosted Parakeet for now), or a Whisper model file they download themselves and pick in Settings (#57). The app doesn't ship or download a model. We rejected a bundled model because it adds 75–150 MB to every install for a feature some learners won't use, and we rejected cloud-only because a local-first app should be able to keep audio on the computer. A custom-server URL was dropped as a power-user feature most learners wouldn't use.

## Consequences

The page records and sends the audio to the local server, which calls the chosen voice engine. Keys stay on the server (ADR 0009), and the page's content security policy still allows connections only to the server. Cloud voice engines use the same saved or environment key as that provider's chat models, so adding one key turns on both. A voice engine that isn't a chat provider, like Deepgram, keeps its key in the same encrypted file under its own id, and is added and removed in Settings → Voice. Its environment variable, like `DEEPGRAM_API_KEY`, still wins. NVIDIA's hosted Parakeet is reached over plain HTTP, which only its `parakeet-ctc-1.1b-asr` model answers, so no gRPC library is added. It can't decode WebM, so the page converts each recording to 16 kHz WAV before sending it, and its function ID is looked up by name because NVIDIA can change it.

The window may use the microphone and nothing else, and only from the app's own page. On macOS, the system asks the learner once.

A cloud voice engine receives the learner's audio, and its pricing and retention apply. Settings says where each recording goes.
