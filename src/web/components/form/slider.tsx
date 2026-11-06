import { cn } from "cn";
import { Slider as SliderPrimitive } from "radix-ui";
import { useState, type ComponentProps } from "react";

interface SliderProps extends ComponentProps<typeof SliderPrimitive.Root> {
	/** What the handle controls, for screen readers. */
	label: string;
	/** How to read the value aloud, when the number alone doesn't say it. */
	valueText?: string;
	/** Nothing has been chosen yet, so the handle is hollow and there's no fill. */
	unset?: boolean;
}

/** The handle follows the pointer exactly, and only the arrow keys animate it. See Motion in DESIGN.md. */
function Slider({
	className,
	label,
	valueText,
	unset = false,
	onKeyDown,
	onPointerDown,
	...props
}: SliderProps) {
	const [usingKeys, setUsingKeys] = useState(false);
	return (
		<SliderPrimitive.Root
			data-slot="slider"
			data-keys={usingKeys || undefined}
			className={cn(
				"relative flex h-4 w-full touch-none items-center select-none motion-safe:data-keys:*:transition-[left,right] motion-safe:data-keys:*:duration-[250ms] motion-safe:data-keys:*:ease-spring-highlight motion-safe:data-keys:**:data-[slot=slider-range]:transition-[right] motion-safe:data-keys:**:data-[slot=slider-range]:duration-[250ms] motion-safe:data-keys:**:data-[slot=slider-range]:ease-spring-highlight",
				className,
			)}
			onKeyDown={(event) => {
				setUsingKeys(true);
				onKeyDown?.(event);
			}}
			onPointerDown={(event) => {
				setUsingKeys(false);
				onPointerDown?.(event);
			}}
			{...props}
		>
			<SliderPrimitive.Track
				data-slot="slider-track"
				className="relative h-1 w-full grow overflow-hidden rounded-full bg-border"
			>
				{!unset && (
					<SliderPrimitive.Range
						data-slot="slider-range"
						className="absolute h-full bg-primary select-none"
					/>
				)}
			</SliderPrimitive.Track>
			<SliderPrimitive.Thumb
				data-slot="slider-thumb"
				aria-label={label}
				aria-valuetext={valueText}
				className={cn(
					"relative block size-4 shrink-0 rounded-full select-none after:absolute after:-inset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
					unset ? "border-[1.5px] border-muted-foreground bg-card" : "bg-primary",
				)}
			/>
		</SliderPrimitive.Root>
	);
}

export { Slider };
