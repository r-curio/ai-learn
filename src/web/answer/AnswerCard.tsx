import { cn } from "cn";
import { useState } from "react";
import Markdown from "react-markdown";
import { stripCitations } from "../../shared/citations.ts";
import type {
	ContextUsage,
	ProviderOption,
	Question,
	QuestionAnswer,
	VoiceEngineOption,
} from "../../shared/protocol.ts";
import { Button } from "../components/button.tsx";
import { Notice } from "../components/Notice.tsx";
import { markdownPlugins } from "../chat/markdown.ts";
import styles from "../chat/prose.module.css";
import type { ModelChoice } from "../composer/useModelChoice.ts";
import { AnswerChoices } from "./AnswerChoices.tsx";
import { AnswerFooter } from "./AnswerFooter.tsx";
import { ConfidenceSlider } from "./ConfidenceSlider.tsx";
import { RecordingIndicator } from "../voice/RecordingIndicator.tsx";
import { useHoldToTalk } from "../voice/useHoldToTalk.ts";
import { addWords, useVoiceRecorder } from "../voice/useVoiceRecorder.ts";
import { VoiceNotice } from "../voice/VoiceNotice.tsx";
import { OtherAnswers } from "./OtherAnswers.tsx";
import { ReasoningField } from "./ReasoningField.tsx";
import { useAnswerDraft } from "./useAnswerDraft.ts";

interface AnswerCardProps {
	question: Question;
	/** An answer the server refused, brought back with the reason so it isn't lost. */
	refused?: { answer: QuestionAnswer; message: string };
	/** The app can't reply yet, so the card dims and can't be submitted. */
	dimmed: boolean;
	providers: ProviderOption[];
	modelChoice: ModelChoice;
	context?: ContextUsage;
	onSubmit: (answer: QuestionAnswer) => void;
	onNewChat: () => void;
	onAddProvider: () => void;
	voiceEngines: VoiceEngineOption[];
	onOpenVoiceSettings: () => void;
}

/** The fields spoken words can go into. */
type Dictation = "reasoning" | "own";

/** Written like the reply it joins once answered, without citation links, which need a saved page to open. */
function QuestionText({ text }: { text: string }) {
	return (
		<div className={cn(styles.prose, "flex-none text-[17px] leading-[25px] font-medium")}>
			<Markdown {...markdownPlugins}>{stripCitations(text)}</Markdown>
		</div>
	);
}

/**
 * Holding space speaks into the focused field, or the reasoning field when focus is elsewhere.
 * `indicator` is frame 21's recording state for whichever field is getting the words. The answer
 * can't be submitted while `voice.busy`, since the last words haven't arrived.
 */
function useDictation(
	engines: VoiceEngineOption[],
	enabled: boolean,
	fields: Record<Dictation, (change: (current: string) => string) => void>,
) {
	const [dictation, setDictation] = useState<Dictation>("reasoning");
	const voice = useVoiceRecorder(engines, (words) =>
		fields[dictation]((current) => addWords(current, words)),
	);
	useHoldToTalk({ voice, enabled, fallback: "reasoning", onStart: setDictation });
	const indicator = (field: Dictation) =>
		voice.phase === "recording" && dictation === field ? (
			<RecordingIndicator levels={voice.levels} startedAt={voice.startedAt} />
		) : undefined;
	return { voice, indicator };
}

/** Takes the composer's place while the tutor waits. Every state keeps the same height, so its top edge stays put. */
export function AnswerCard(props: AnswerCardProps) {
	const { question, refused, dimmed, onSubmit } = props;
	const draft = useAnswerDraft(refused?.answer);
	const { selection, setSelection, ownText, setOwnText, confidence, setConfidence } = draft;
	const { reasoning, setReasoning, answer } = draft;
	const { voice, indicator } = useDictation(props.voiceEngines, !dimmed, {
		own: setOwnText,
		reasoning: setReasoning,
	});
	const unknown = selection === "unknown";
	const canSubmit = Boolean(answer) && !dimmed && !voice.busy;

	function submit() {
		if (canSubmit && answer) onSubmit(answer);
	}

	return (
		<div className="chat-column flex max-h-[85%] min-h-0 flex-none animate-in flex-col pt-1.5 pb-5 duration-200 ease-fluid fade-in-0 motion-safe:slide-in-from-bottom-1">
			<section
				aria-label="The tutor's question"
				className={cn(
					"flex min-h-0 flex-col gap-3 overflow-y-auto rounded-3xl border border-border bg-card p-3.5",
					dimmed && "opacity-50",
				)}
			>
				<QuestionText text={question.text} />
				<div className="flex-none">
					<AnswerChoices
						choices={question.choices}
						selected={typeof selection === "number" ? selection : undefined}
						onSelect={setSelection}
					/>
				</div>
				<OtherAnswers
					selection={selection}
					ownText={ownText}
					recording={indicator("own")}
					onSelect={setSelection}
					onOwnTextChange={setOwnText}
				/>
				<ConfidenceSlider confidence={confidence} notNeeded={unknown} onChange={setConfidence} />
				<ReasoningField
					value={reasoning}
					placeholder={unknown ? "What's confusing you?" : "Why do you think that?"}
					recording={indicator("reasoning")}
					onChange={setReasoning}
					onSubmit={submit}
				/>
				{refused && <Notice error>{refused.message}</Notice>}
				<VoiceNotice voice={voice} onOpenSettings={props.onOpenVoiceSettings} />
				<Button
					className="h-10 w-full flex-none px-3.5 leading-[18px]"
					disabled={!canSubmit}
					onClick={submit}
				>
					Submit answer
				</Button>
			</section>
			<AnswerFooter {...props} disabled={dimmed} />
		</div>
	);
}
