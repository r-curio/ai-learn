# ai-learn

A local-first app where an AI tutor helps someone understand hard topics. This glossary fixes the words used in code, docs, and discussion.

## People and roles

**Learner**:
The person using the app to understand something.
_Avoid_: User, student

**Tutor**:
The AI role the learner talks to.
_Avoid_: Bot, assistant, teacher

**Owner**:
The person who decides what merges into this repo.
_Avoid_: Maintainer, admin

## Conversations

**Session**:
One saved conversation between a learner and the tutor. The UI calls this a "chat", because that's the word learners expect.
_Avoid_: Conversation, thread

**Turn**:
One message from the learner and everything the tutor does in response.
_Avoid_: Exchange, round

**Run**:
The work of producing the tutor's response to one turn, which can include several model calls and tool uses.
_Avoid_: Job, request

**Reply**:
What the tutor produces during a run.
_Avoid_: Response, answer, completion

**Transcript**:
A session as the learner sees it, with one reply per turn.
_Avoid_: History, chat log

**Session log**:
The permanent, append-only record of a session, from which everything else can be rebuilt.
_Avoid_: Transcript, history

**Session index**:
A SQLite file that copies session summaries and each chat's visible text for fast lookups and search. It can always be rebuilt from the session folders, so nothing is stored only there.
_Avoid_: Database, session store

## How a reply can end

**Stopped reply**:
A reply the learner ended on purpose. It stays visible and can't be retried.
_Avoid_: Cancelled reply, aborted reply

**Failed reply**:
A reply that ended because of an error from the model or provider. It can be retried.
_Avoid_: Errored reply

**Interrupted reply**:
A reply that never finished because the app closed. It can be retried.
_Avoid_: Crashed reply, partial reply

**Retry**:
Asking the tutor to produce a failed or interrupted reply again, without the learner resending anything.
_Avoid_: Regenerate, resend

## Material

**Attachment**:
A file the learner adds to a session, which is an image, a PDF, or a text file.
_Avoid_: Upload, source, document

**Draft**:
An attachment that's been added but not yet sent in a message.
_Avoid_: Pending file

## The system

**Harness**:
The part of the app that runs the tutor: it assembles context, calls the model, runs tools, and saves the session log.
_Avoid_: Agent, backend

**Engine**:
The connection to a specific model and provider that the harness uses.
_Avoid_: Provider, backend

**Fake model**:
A scripted stand-in for a real model, used for tests and trying the app at no cost.
_Avoid_: Mock, stub

**Provider**:
A company or service that runs models, like Anthropic or OpenRouter. The learner connects one by adding its API key.
_Avoid_: Vendor, backend

**Effort**:
How hard a model works on a reply, from Low to Max. It's Pi's thinking level under a name learners understand.
_Avoid_: Thinking level (in the UI), reasoning level

**Preferences**:
Settings the learner chooses, like whether the sidebar is open, saved in the app's data folder.
_Avoid_: Settings file, config

## Working on the repo

**Proof**:
Evidence from an actual run that a change works, posted as a pull request comment.
_Avoid_: Verification, demo
