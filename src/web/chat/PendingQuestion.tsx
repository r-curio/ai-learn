import type { Question } from "../../shared/protocol.ts";
import { Button } from "../components/button.tsx";

/** A stopgap until the answer card (#25), so a question never leaves a chat stuck. */
export function PendingQuestion({
	question,
	onDontKnow,
}: {
	question: Question;
	onDontKnow: () => void;
}) {
	return (
		<div className="flex flex-col items-start gap-3">
			<ol className="flex flex-col gap-1">
				{question.choices.map((choice, index) => (
					<li key={index}>
						{String.fromCharCode(65 + index)}. {choice}
					</li>
				))}
			</ol>
			<Button variant="outline" className="text-foreground" onClick={onDontKnow}>
				I don't know
			</Button>
			<p className="text-[13px] leading-4 text-muted-foreground">
				Picking an answer isn't available yet.
			</p>
		</div>
	);
}
