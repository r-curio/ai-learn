import { cn } from "cn";
import { Tabs as TabsPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

function Tabs({ className, ...props }: ComponentProps<typeof TabsPrimitive.Root>) {
	return <TabsPrimitive.Root data-slot="tabs" className={className} {...props} />;
}

function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
	return (
		<TabsPrimitive.List
			data-slot="tabs-list"
			className={cn("relative flex h-8 gap-0.5 rounded-md bg-secondary p-[3px]", className)}
			{...props}
		/>
	);
}

function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
	return (
		<TabsPrimitive.Trigger
			data-slot="tabs-trigger"
			className={cn(
				"relative flex flex-1 basis-0 items-center justify-center rounded-sm text-[13px] leading-4 whitespace-nowrap text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring data-[state=active]:font-medium data-[state=active]:text-foreground",
				className,
			)}
			{...props}
		/>
	);
}

interface SegmentedTabsProps<Value extends string> {
	/** Names the choice for screen readers, since the frames show no label. */
	label: string;
	value: Value;
	options: readonly { value: Value; label: string }[];
	/** `large` is the new chat screen's size. */
	size?: "small" | "large";
	className?: string;
	onChange: (value: Value) => void;
}

const GAP = 2;
const INSET = 3;

/** Equal-width tabs on a track, with one background that slides to the active tab. */
export function SegmentedTabs<Value extends string>({
	label,
	value,
	options,
	size = "small",
	className,
	onChange,
}: SegmentedTabsProps<Value>) {
	const count = options.length;
	const active = options.findIndex((option) => option.value === value);
	const large = size === "large";
	return (
		<Tabs className={className} value={value} onValueChange={(next) => onChange(next as Value)}>
			<TabsList aria-label={label} className={cn(large && "h-9 rounded-lg")}>
				<span
					aria-hidden="true"
					className={cn(
						"absolute inset-y-[3px] left-[3px] rounded-sm bg-card transition-[translate] duration-250 ease-spring-highlight motion-reduce:transition-none",
						large && "rounded-[7px]",
					)}
					style={{
						width: `calc((100% - ${2 * INSET + GAP * (count - 1)}px) / ${count})`,
						translate: `calc(${active} * (100% + ${GAP}px)) 0`,
					}}
				/>
				{options.map((option) => (
					// These tabs change what's shown elsewhere, so there's no tab panel to point at.
					<TabsTrigger
						key={option.value}
						value={option.value}
						aria-controls={undefined}
						className={cn(large && "rounded-[7px] text-[14px] leading-[18px]")}
					>
						{option.label}
					</TabsTrigger>
				))}
			</TabsList>
		</Tabs>
	);
}
