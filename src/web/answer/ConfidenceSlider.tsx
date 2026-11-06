import { cn } from "cn";
import { Slider } from "../components/form/slider.tsx";

/** Where the handle rests until the learner moves it, which says nothing about how sure they are. */
const MIDDLE = 50;

export function ConfidenceSlider({
	confidence,
	notNeeded,
	onChange,
}: {
	confidence?: number;
	/** The learner doesn't know, so there's no confidence to give. */
	notNeeded: boolean;
	onChange: (confidence: number) => void;
}) {
	const shown = notNeeded ? undefined : confidence;
	const status = notNeeded ? "Not needed" : shown === undefined ? "Not set" : `${shown}% sure`;
	return (
		<div
			className={cn(
				"flex flex-none flex-col gap-2 transition-opacity duration-150",
				notNeeded && "opacity-45",
			)}
		>
			<div className="flex items-center justify-between text-[13px] leading-4 text-muted-foreground">
				<span>How sure are you?</span>
				<span className={cn("tabular-nums", shown !== undefined && "font-medium text-foreground")}>
					{status}
				</span>
			</div>
			<div className="flex flex-col gap-1">
				<Slider
					label="How sure are you?"
					valueText={status}
					unset={shown === undefined}
					disabled={notNeeded}
					value={[shown ?? MIDDLE]}
					// Radix reports no change for a press on the unmoved handle, but that's still a choice.
					onPointerDown={() => {
						if (shown === undefined && !notNeeded) onChange(MIDDLE);
					}}
					onValueChange={([value = MIDDLE]) => onChange(value)}
				/>
				<div className="flex justify-between text-[12px] leading-4 text-muted-foreground">
					<span>Just guessing</span>
					<span>Certain</span>
				</div>
			</div>
		</div>
	);
}
