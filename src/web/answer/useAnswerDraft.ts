import { useState } from "react";
import type { QuestionAnswer } from "../../shared/protocol.ts";

/** A choice's index, the learner's own answer, or that they don't know. Nothing at first. */
export type Selection = number | "own" | "unknown" | undefined;

function selectionOf(answer?: QuestionAnswer): Selection {
	if (answer?.kind === "choice") return answer.choice;
	return answer?.kind;
}

/** The answer being put together in the card. `initial` brings back one the server refused. */
export function useAnswerDraft(initial?: QuestionAnswer) {
	const [selection, setSelection] = useState<Selection>(selectionOf(initial));
	const [ownText, setOwnText] = useState(initial?.kind === "own" ? initial.text : "");
	const [confidence, setConfidence] = useState<number | undefined>(
		initial && "confidence" in initial ? initial.confidence : undefined,
	);
	const [reasoning, setReasoning] = useState(initial?.reasoning ?? "");

	/** The answer to send, once there's enough of it. Reasoning is always optional. */
	function complete(): QuestionAnswer | undefined {
		const note = reasoning.trim() ? { reasoning: reasoning.trim() } : {};
		if (selection === "unknown") return { kind: "unknown", ...note };
		if (confidence === undefined) return undefined;
		if (typeof selection === "number")
			return { kind: "choice", choice: selection, confidence, ...note };
		if (selection === "own" && ownText.trim())
			return { kind: "own", text: ownText.trim(), confidence, ...note };
		return undefined;
	}

	return {
		selection,
		setSelection,
		ownText,
		setOwnText,
		confidence,
		setConfidence,
		reasoning,
		setReasoning,
		answer: complete(),
	};
}
