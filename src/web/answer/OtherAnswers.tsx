import { cn } from "cn";
import { Pencil } from "lucide-react";
import { useRef } from "react";
import { flushSync } from "react-dom";
import { Button } from "../components/button.tsx";
import { OwnAnswer } from "./OwnAnswer.tsx";
import type { Selection } from "./useAnswerDraft.ts";

const OTHER_ANSWER = "h-[38px] gap-2 px-2.5 text-[14px] leading-[18px] font-normal text-foreground";

/** "I don't know" and "Type my own answer", or the learner's own answer filling the whole row. */
export function OtherAnswers({
	selection,
	ownText,
	onSelect,
	onOwnTextChange,
}: {
	selection: Selection;
	ownText: string;
	onSelect: (selection: Selection) => void;
	onOwnTextChange: (text: string) => void;
}) {
	const typeOwn = useRef<HTMLButtonElement>(null);
	const unknown = selection === "unknown";

	function closeOwnAnswer() {
		// The pressed button is leaving, so bring its row back now and move the keyboard there.
		flushSync(() => {
			onOwnTextChange("");
			onSelect(undefined);
		});
		typeOwn.current?.focus();
	}

	if (selection === "own")
		return <OwnAnswer text={ownText} onTextChange={onOwnTextChange} onClose={closeOwnAnswer} />;

	return (
		<div className="grid flex-none grid-cols-2 gap-1.5">
			<Button
				variant="outline"
				aria-pressed={unknown}
				className={cn(
					OTHER_ANSWER,
					unknown &&
						"border-[1.5px] border-primary bg-accent hover:bg-accent hover:text-foreground",
				)}
				onClick={() => onSelect(unknown ? undefined : "unknown")}
			>
				I don't know
			</Button>
			<Button
				ref={typeOwn}
				variant="outline"
				className={OTHER_ANSWER}
				onClick={() => onSelect("own")}
			>
				<Pencil className="text-muted-foreground" strokeWidth={1.5} />
				Type my own answer
			</Button>
		</div>
	);
}
