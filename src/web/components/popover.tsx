import { cn } from "cn";
import { Popover as PopoverPrimitive } from "radix-ui";
import * as React from "react";

function Popover({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Root>) {
	return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
	return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverAnchor({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
	return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />;
}

/** Opens with the Pop spring and closes at `exit`. See Motion in DESIGN.md. */
function PopoverContent({
	className,
	align = "center",
	sideOffset = 4,
	...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
	return (
		<PopoverPrimitive.Portal>
			<PopoverPrimitive.Content
				data-slot="popover-content"
				align={align}
				sideOffset={sideOffset}
				className={cn(
					"z-50 origin-(--radix-popover-content-transform-origin) rounded-xl border border-border bg-popover text-popover-foreground shadow-popover outline-hidden data-open:animate-in data-open:duration-250 data-open:ease-spring-pop data-open:fade-in-0 motion-safe:data-open:zoom-in-[0.98] motion-safe:data-[side=bottom]:data-open:slide-in-from-top-1 motion-safe:data-[side=top]:data-open:slide-in-from-bottom-1 data-closed:animate-out data-closed:duration-120 data-closed:ease-exit data-closed:fade-out-0",
					className,
				)}
				{...props}
			/>
		</PopoverPrimitive.Portal>
	);
}

export { Popover, PopoverTrigger, PopoverAnchor, PopoverContent };
