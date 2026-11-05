import { cn } from "cn";
import { ChevronDown } from "lucide-react";
import { Slider } from "radix-ui";
import type { RefObject } from "react";
import { Button } from "../components/button.tsx";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "../components/popover.tsx";
import { COMPOSER_MENU, MENU_TRIGGER } from "./ModelPicker.tsx";
import type { Effort } from "../settings/useProviders.ts";
import { ALL_EFFORTS, EFFORT_LABELS, type ModelChoice } from "./useModelChoice.ts";

const KNOB_WIDTH = 62;
const TRACK_PADDING = 3;
const LAST_STOP = ALL_EFFORTS.length - 1;

/** Where a stop's centre sits, keeping in step with the knob, which stays inside the track. */
function stopCentre(index: number) {
	return `calc(${KNOB_WIDTH / 2}px + (100% - ${KNOB_WIDTH}px) * ${index / LAST_STOP})`;
}

/** The knob's right edge plus the track's padding, which is exactly the full width at the last stop. */
function trailWidth(index: number) {
	const travel = `(100% - ${KNOB_WIDTH + 2 * TRACK_PADDING}px) * ${index / LAST_STOP}`;
	return `calc(${KNOB_WIDTH + 2 * TRACK_PADDING}px + ${travel})`;
}

/**
 * The allowed level to land on, carrying on in the direction of travel. Snapping to the nearest
 * would trap the arrow keys on a model with a gap, since one step from Low to a missing Medium
 * would land straight back on Low.
 */
function allowedStop(index: number, from: number, allowed: Effort[]) {
	const stops = allowed.map((level) => ALL_EFFORTS.indexOf(level));
	const stop =
		index > from
			? (stops.find((other) => other >= index) ?? stops.at(-1))
			: (stops.findLast((other) => other <= index) ?? stops[0]);
	return stop === undefined ? undefined : ALL_EFFORTS[stop];
}

/** A slider that only rests on named levels. The knob carries the current level's name. */
function EffortSlider({ choice }: { choice: ModelChoice }) {
	const { model, effort, setEffort } = choice;
	if (!model || !effort) return null;
	const value = ALL_EFFORTS.indexOf(effort);

	return (
		<div className="relative rounded-full bg-secondary p-[3px]">
			{/* Runs from the left edge through the knob, so Max fills the whole bar. */}
			<div
				className="absolute inset-y-0 left-0 rounded-full bg-primary motion-safe:transition-[width] motion-safe:duration-250 motion-safe:ease-spring-highlight"
				style={{ width: trailWidth(value) }}
			/>
			<Slider.Root
				min={0}
				max={LAST_STOP}
				step={1}
				value={[value]}
				onValueChange={([index = value]) => {
					const next = allowedStop(index, value, model.efforts);
					if (next) setEffort(next);
				}}
				className="relative flex h-[34px] w-full touch-none items-center select-none motion-safe:[&>span:has([role=slider])]:transition-[left] motion-safe:[&>span:has([role=slider])]:duration-250 motion-safe:[&>span:has([role=slider])]:ease-spring-highlight"
			>
				{ALL_EFFORTS.map((level, index) => (
					<span
						key={level}
						aria-hidden="true"
						style={{ left: stopCentre(index) }}
						className={cn(
							"pointer-events-none absolute -translate-x-1/2 text-[12px] leading-4 whitespace-nowrap text-muted-foreground",
							!model.efforts.includes(level) && "opacity-45",
							index < value && "text-primary-foreground",
						)}
					>
						{EFFORT_LABELS[level]}
					</span>
				))}
				<Slider.Thumb
					aria-label="Effort"
					aria-valuetext={EFFORT_LABELS[effort]}
					style={{ width: KNOB_WIDTH }}
					className="relative z-10 flex h-[34px] cursor-grab items-center justify-center rounded-full bg-card text-[12px] leading-4 font-medium whitespace-nowrap text-foreground outline-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:cursor-grabbing"
				>
					{EFFORT_LABELS[effort]}
				</Slider.Thumb>
			</Slider.Root>
		</div>
	);
}

interface EffortMenuProps {
	choice: ModelChoice;
	anchor: RefObject<HTMLDivElement | null>;
	disabled: boolean;
}

export function EffortMenu({ choice, anchor, disabled }: EffortMenuProps) {
	const { effort } = choice;
	return (
		<Popover>
			<PopoverAnchor virtualRef={anchor} />
			<PopoverTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					disabled={disabled || !effort}
					className={`${MENU_TRIGGER} font-normal text-muted-foreground aria-expanded:text-muted-foreground`}
				>
					{effort ? `${EFFORT_LABELS[effort]} effort` : "No effort levels"}
					<ChevronDown className="size-3 text-muted-foreground" strokeWidth={2.8} />
				</Button>
			</PopoverTrigger>
			<PopoverContent {...COMPOSER_MENU} className="w-[340px] p-2.5">
				<EffortSlider choice={choice} />
			</PopoverContent>
		</Popover>
	);
}
