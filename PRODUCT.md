# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

The UI is a web app inside an Electron desktop shell. The desktop app targets macOS, Windows, and Linux equally. The browser mode is for development only.

## Users

Anyone learning anything. The primary user, called the learner, can be studying any subject at any level, and the tutor finds out their level in a probing stage. They come to the app because they want to understand a topic, often bringing their own images, PDFs, or text files.

## Product Purpose

ai-learn is a local-first learning app where an AI tutor helps a learner understand a topic. Success means the learner can show they understand it, not only that they received an answer.

## Positioning

ai-learn checks real understanding. A general AI chat answers what it's asked, while the ai-learn tutor is meant to start with a probing stage to find the learner's knowledge level, ask questions with confidence ratings, and plan teaching from the results.

This is the product's direction, not its current behaviour. The teaching engine isn't built yet, so today the app behaves like a general tutor chat. Don't claim otherwise in the product or its copy until it ships.

## Operating Context

- A learner chats with the tutor in saved sessions, which the UI calls chats, and can reopen and continue them.
- Attachments are added with a button, by drag and drop, or by pasting.
- Replies stream in and can be stopped. Failed and interrupted replies can be retried.
- Running on a real model bills the learner's own provider API key, so token and cost totals are shown.

## Capabilities and Constraints

**Works today:** streaming replies, attachments, saved chats, crash recovery, retry, token and cost totals, and a fake model that runs at no cost.

**Planned:** the teaching engine with its probing stage, questions with confidence, two-way Excalidraw diagrams, and knowledge memory with a graph view. The chat redesign is tracked in issue #31, which also lists its open decisions.

**Constraints:**

- Files and app data stay on the learner's computer, but messages and attachments go to the provider of the chosen model to generate replies. Never describe the app as fully private or offline.
- The desktop shell must work on macOS, Windows, and Linux, including window controls and keyboard shortcuts. Anything drawn for one system, such as space for the macOS traffic lights, needs an equivalent on the others.
- Images must be 5 MB or smaller, and scanned PDFs without a text layer aren't supported.
- Use the terms in `GLOSSARY.md`, such as learner, tutor, reply, and attachment. The UI says "chat" where the code says "session".

**Undecided:**

- How someone without developer tools will get the app. Today it runs from source and needs Node and an Anthropic API key, with no packaged installer, which doesn't yet suit a learner with no technical background.
- What Practice does differently from Learning (issue #21).

## Brand Commitments

The product's name is "ai-learn", written in lowercase. The AI role is always "the tutor". The tutor's instructions describe it as patient and accurate, and it says when it's unsure.

## Evidence on Hand

- The chosen M1 design: [M1 · Chosen design](https://app.paper.design/file/01M6K667H87BCQPSD9R4ZWSTST/p-4-0) in Paper.
- No testimonials, customers, usage data, or learning-outcome results exist. Don't invent any, and don't claim that the app improves learning until there's evidence.

## Product Principles

1. **Understanding over answers.** When a choice arises between giving a quick answer and finding out what the learner understands, favour understanding.
2. **Probe before teaching.** The learning process starts with a probing stage, so the tutor teaches from the learner's actual knowledge level rather than guessing it.
3. **Be honest about the tutor.** Show what the tutor is doing, what it costs, and when it's unsure or has failed.
4. **Be truthful about data.** State plainly what stays on the computer and what goes to the model provider.
5. **Never lose the learner's work.** Saved chats survive crashes and can be reopened exactly as they were.
