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

**Chat type**:
Whether a session is Learning or Practice, chosen when it starts and fixed after that. Saved in the session log's header, and a log with none counts as Learning. For now it only organizes the chat list, and the tutor behaves the same in both.
_Avoid_: Mode, category

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

**Activity**:
The block above a reply showing the tutor's reasoning summary and tool trace. It's open during the work, and collapses to "Worked for 24s" when the reply starts.
_Avoid_: Thinking block, steps

**Session log**:
The permanent, append-only record of a session, from which everything else can be rebuilt.
_Avoid_: Transcript, history

**Session index**:
A SQLite file that copies session summaries and each chat's visible text for fast lookups and search. It can always be rebuilt from the session folders, so nothing is stored only there.
_Avoid_: Database, session store

**Question**:
Something the tutor asks the learner, with 2 to 4 choices, through `ask_question` when there's no right answer or `quiz` when there is. A run ends when it asks one.
_Avoid_: Prompt

**Quiz**:
A question with a right answer. The tutor commits the answer and an explanation before the learner sees it, and the learner sees both only after answering. A picked choice is graded right or wrong straight away, an answer in the learner's own words is graded by the tutor in its reply, and "I don't know" just shows the answer. Its role is `predict`, a guess before a step is taught, or `check`, whether a step landed.
_Avoid_: Test, exam

**Pending question**:
A question with no answer yet. It's saved as a tool call with no result, and the session can't continue until it's answered.
_Avoid_: Open question, paused run

**Answer**:
What the learner gives a question: a choice, their own text, or "I don't know", plus confidence and reasoning.
_Avoid_: Response, reply

**Confidence**:
How sure the learner says they are of an answer, from 0 to 100. An "I don't know" has none.
_Avoid_: Certainty, score

**Learner's reasoning**:
The optional words a learner adds to an answer. The tutor reads them, and they don't show in the transcript. The tutor's own reasoning belongs to Activity.
_Avoid_: Explanation, justification

**Context**:
How full a session is: the size of the last model call's input against the model's limit. It's not the running token total shown in the top bar.
_Avoid_: Memory, usage

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

**Citation**:
A link in a reply, like "p. 4", to the passage of a PDF the tutor is relying on. It opens the attachment pane with the passage highlighted.
_Avoid_: Reference, source

**Attachment pane**:
The area beside the chat that shows a sent attachment. The chat and sidebar narrow while it's open.
_Avoid_: Viewer, preview, PDF panel

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

**Voice engine**:
What turns the learner's recording into text: a cloud provider with their key, or a model file on their computer. The learner chooses one in Settings.
_Avoid_: STT provider, ASR

**Preferences**:
Settings the learner chooses, like whether the sidebar is open, saved in the app's data folder.
_Avoid_: Settings file, config

## Working on the repo

**Proof**:
Evidence from an actual run that a change works, posted as a pull request comment.
_Avoid_: Verification, demo
