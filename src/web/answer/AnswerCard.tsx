import { cn } from "cn";
import type { KeyboardEvent } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { stripCitations } from "../../shared/citations.ts";
import type {
	ContextUsage,
	ProviderOption,
	Question,
	QuestionAnswer,
} from "../../shared/protocol.ts";
import { Button } from "../components/button.tsx";
import { Textarea } from "../components/form/textarea.tsx";
import { Notice } from "../components/Notice.tsx";
import styles from "../chat/prose.module.css";
import type { ModelChoice } from "../composer/useModelChoice.ts";
import { AnswerChoices } from "./AnswerChoices.tsx";
import { AnswerFooter } from "./AnswerFooter.tsx";
import { ConfidenceSlider } from "./ConfidenceSlider.tsx";
import { OtherAnswers } from "./OtherAnswers.tsx";
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
}

/** Written like the reply it joins once answered, without citation links, which need a saved page to open. */
function QuestionText({ text }: { text: string }) {
	return (
		<div className={cn(styles.prose, "flex-none text-[17px] leading-[25px] font-medium")}>
			<Markdown remarkPlugins={[remarkGfm]}>{stripCitations(text)}</Markdown>
		</div>
	);
}

function ReasoningField({
	value,
	placeholder,
	onChange,
	onSubmit,
}: {
	value: string;
	placeholder: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
}) {
	const submitOnEnter = (event: KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
			event.preventDefault();
			onSubmit();
		}
	};
	return (
		<Textarea
			aria-label="Your reasoning"
			rows={1}
			placeholder={placeholder}
			className="max-h-[124px] min-h-11 flex-none resize-none rounded-lg px-3 py-[11px] text-[14px] leading-5 focus-visible:border-muted-foreground focus-visible:ring-0"
			value={value}
			onChange={(event) => onChange(event.target.value)}
			onKeyDown={submitOnEnter}
		/>
	);
}

/** Takes the composer's place while the tutor waits. Every state keeps the same height, so its top edge stays put. */
export function AnswerCard(props: AnswerCardProps) {
	const { question, refused, dimmed, providers, modelChoice, context } = props;
	const { onSubmit, onNewChat, onAddProvider } = props;
	const draft = useAnswerDraft(refused?.answer);
	const { selection, setSelection, ownText, setOwnText, confidence, setConfidence } = draft;
	const { reasoning, setReasoning, answer } = draft;
	const unknown = selection === "unknown";
	const canSubmit = Boolean(answer) && !dimmed;

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
					onSelect={setSelection}
					onOwnTextChange={setOwnText}
				/>
				<ConfidenceSlider confidence={confidence} notNeeded={unknown} onChange={setConfidence} />
				<ReasoningField
					value={reasoning}
					placeholder={unknown ? "What's confusing you?" : "Why do you think that?"}
					onChange={setReasoning}
					onSubmit={submit}
				/>
				{refused && <Notice error>{refused.message}</Notice>}
				<Button
					className="h-10 w-full flex-none px-3.5 leading-[18px]"
					disabled={!canSubmit}
					onClick={submit}
				>
					Submit answer
				</Button>
			</section>
			<AnswerFooter
				providers={providers}
				modelChoice={modelChoice}
				context={context}
				disabled={dimmed}
				onNewChat={onNewChat}
				onAddProvider={onAddProvider}
			/>
		</div>
	);
}
