import { Agent, type AgentState, type StreamFn } from "@earendil-works/pi-agent-core";
import type { Message } from "@earendil-works/pi-ai";
import type { AttachmentStore } from "./attachments.ts";
import type { Engine } from "./engine.ts";
import { phaseOf, phaseSwitch, type SessionPrompt } from "./prompts/phases.ts";
import type { LogTools } from "./sessions/log.ts";
import { questionHooks } from "./sessions/questions.ts";
import { createTools, initialSystemMessage, toolChange } from "./tools.ts";
import { searchGuard } from "./web/web-tools.ts";

/** The Pi agent behind one session, with its question hooks and a runaway search guard that resets each run. */
export function createTutorAgent(options: {
	sessionId: string;
	prompt: SessionPrompt;
	attachments: AttachmentStore;
	messages: Message[];
	streamFn: StreamFn;
}) {
	const guard = searchGuard();
	const agent = new Agent({
		initialState: {
			tools: createTools(options.attachments, undefined, options.prompt.phases && "prober"),
			// Built here, since a saved log can start with a tool change, which Pi would take as the first message.
			messages: [...initialSystemMessage(options.prompt, options.attachments), ...options.messages],
		},
		streamFn: options.streamFn,
		...questionHooks,
		beforeToolCall: guard.after(questionHooks.beforeToolCall),
		sessionId: options.sessionId,
		identity: { attribution: { name: "ai-learn", url: "https://github.com/r-curio/ai-learn" } },
	});
	// Each run gets its own count of searches.
	agent.subscribe((event) => {
		if (event.type === "agent_start") guard.reset();
	});
	return agent;
}

/**
 * Offer the tools and prompt a run can use, so a search key added or removed counts from the next
 * message, and a finished probe hands over to the teacher. A change is saved, then added before
 * Pi would add it itself, so the log matches what's sent. It goes before a new message, as Pi
 * places it, and after an answer, since nothing may come between a tool call and its result.
 */
export async function offerTools(
	state: AgentState,
	prompt: SessionPrompt,
	attachments: AttachmentStore,
	engine: Pick<Engine, "searchService">,
	record: (entry: LogTools) => Promise<void>,
): Promise<void> {
	const phase = phaseOf(prompt, state.messages);
	const tools = createTools(attachments, await engine.searchService(), phase);
	state.tools = tools;
	const change = toolChange(state.messages, tools, phaseSwitch(prompt, state.messages));
	if (!change) return;
	await record({ type: "tools", message: change });
	state.messages.push(change);
}
