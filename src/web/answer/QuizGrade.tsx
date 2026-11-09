import { cn } from "cn";
import { Check, MessageSquareText, X } from "lucide-react";
import Markdown from "react-markdown";
import { stripCitations } from "../../shared/citations.ts";
import type { TranscriptMessage } from "../../shared/protocol.ts";
import { markdownPlugins } from "../chat/markdown.ts";
import styles from "../chat/prose.module.css";

type Grade = NonNullable<TranscriptMessage["grade"]>;

const letter = (index: number) => String.fromCharCode(65 + index);

/** Plain verdicts, with no praise. "I don't know" is never wrong, so it only reveals the answer. */
function verdictLine({ verdict, correctAnswer, choices }: Grade): string {
	const answer = `${letter(correctAnswer)}, ${choices[correctAnswer] ?? ""}`;
	if (verdict === "right") return "Right.";
	if (verdict === "wrong") return `Wrong. The answer is ${answer}.`;
	if (verdict === "own") return "Graded in the reply.";
	return `The answer is ${answer}.`;
}

const ICONS = { right: Check, wrong: X, own: MessageSquareText, unknown: undefined };

/** How a quiz went, under the learner's answer, with the explanation the tutor committed before asking. */
export function QuizGrade({ grade }: { grade: Grade }) {
	const Icon = ICONS[grade.verdict];
	return (
		<section
			aria-label="How your answer went"
			className="flex animate-in flex-col gap-1.5 rounded-2xl border border-border bg-card px-4 py-3 duration-200 ease-fluid fade-in-0"
		>
			<p
				className={cn(
					"flex items-center gap-1.5 text-[14px] leading-[18px] font-medium",
					grade.verdict === "right" && "text-primary",
					grade.verdict === "wrong" && "text-destructive",
				)}
			>
				{Icon && <Icon aria-hidden className="size-4 flex-none" />}
				{verdictLine(grade)}
			</p>
			<div className={cn(styles.prose, "text-muted-foreground")}>
				<Markdown {...markdownPlugins}>{stripCitations(grade.explanation)}</Markdown>
			</div>
		</section>
	);
}
