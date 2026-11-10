import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { createInitialSystemMessage, type SystemMessage, type Tool } from "@earendil-works/pi-ai";
import type { ChatType } from "../../shared/protocol.ts";
import { FINISH_PROBE } from "./finish-probe.ts";
import { SYSTEM_PROMPT } from "./tutor-prompt.ts";
import purpose from "./shared/00-purpose.md" with { type: "text" };
import voice from "./shared/10-voice.md" with { type: "text" };
import accuracy from "./shared/20-accuracy.md" with { type: "text" };
import readingTheLearner from "./shared/30-reading-the-learner.md" with { type: "text" };
import questions from "./shared/40-questions.md" with { type: "text" };
import material from "./shared/50-material.md" with { type: "text" };
import formatting from "./shared/60-formatting.md" with { type: "text" };
import probe from "./prober/10-probe.md" with { type: "text" };
import method from "./teacher/10-method.md" with { type: "text" };
import plan from "./teacher/20-plan.md" with { type: "text" };
import teachingCycle from "./teacher/30-teaching-cycle.md" with { type: "text" };
import ending from "./teacher/40-ending.md" with { type: "text" };

/** The prompt a session's header saves. Practice chats, and chats from before phases, have no phases. */
export interface SessionPrompt {
	systemPrompt: string;
	phases?: { prober: string; teacher: string };
}

export type Phase = "prober" | "teacher";

/** The name of the system prompt section that holds the current phase. */
const PHASE = "phase";

// In name order, like the files. Pi renders a section after the shared text with a blank line between.
const joined = (segments: string[]) => segments.map((text) => text.trim()).join("\n\n---\n\n");
const section = (segments: string[]) => `---\n\n${joined(segments)}`;

const LEARNING: SessionPrompt = {
	systemPrompt: joined([
		purpose,
		voice,
		accuracy,
		readingTheLearner,
		questions,
		material,
		formatting,
	]),
	phases: {
		prober: section([probe]),
		teacher: section([method, plan, teachingCycle, ending]),
	},
};

/** What a new chat of this type starts with. Learning chats probe first, and Practice keeps the single prompt. */
export const promptFor = (chatType: ChatType): SessionPrompt =>
	chatType === "learning" ? LEARNING : { systemPrompt: SYSTEM_PROMPT };

/** A session's first message: the shared prompt with the prober's section, or a single prompt. */
export function leadingMessage(prompt: SessionPrompt, tools: Tool[]): SystemMessage | undefined {
	const message = createInitialSystemMessage(prompt.systemPrompt, tools);
	if (!message || !prompt.phases) return message;
	return { ...message, sections: { [PHASE]: prompt.phases.prober } };
}

const isSystem = (message: AgentMessage): message is SystemMessage => message.role === "system";

const switched = (messages: readonly AgentMessage[]) =>
	messages.slice(1).some((message) => isSystem(message) && message.sections?.[PHASE] !== undefined);

const probeFinished = (messages: readonly AgentMessage[]) =>
	messages.some(
		(message) =>
			message.role === "toolResult" && message.toolName === FINISH_PROBE && !message.isError,
	);

/** The phase the next model call runs in, read from the history, or nothing for a single-prompt chat. */
export function phaseOf(
	prompt: SessionPrompt,
	messages: readonly AgentMessage[],
): Phase | undefined {
	if (!prompt.phases) return undefined;
	return switched(messages) || probeFinished(messages) ? "teacher" : "prober";
}

/** The section change that hands over to the teacher, once the probe has finished and only once. */
export function phaseSwitch(
	prompt: SessionPrompt,
	messages: readonly AgentMessage[],
): Record<string, string> | undefined {
	if (!prompt.phases || switched(messages) || !probeFinished(messages)) return undefined;
	return { [PHASE]: prompt.phases.teacher };
}
