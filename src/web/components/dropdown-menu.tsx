import { cn } from "cn";
import { Check } from "lucide-react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import * as React from "react";

function DropdownMenu({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
	return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuTrigger({
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
	return <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

/** Opens with the Pop spring and closes at `exit`. See Motion in DESIGN.md. */
function DropdownMenuContent({
	className,
	align = "start",
	sideOffset = 4,
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
	return (
		<DropdownMenuPrimitive.Portal>
			<DropdownMenuPrimitive.Content
				data-slot="dropdown-menu-content"
				sideOffset={sideOffset}
				align={align}
				className={cn(
					"z-50 max-h-(--radix-dropdown-menu-content-available-height) origin-(--radix-dropdown-menu-content-transform-origin) overflow-y-auto rounded-xl border border-border bg-popover px-2 py-3 text-popover-foreground shadow-popover data-open:animate-in data-open:duration-250 data-open:ease-spring-pop data-open:fade-in-0 motion-safe:data-open:zoom-in-[0.98] motion-safe:data-[side=bottom]:data-open:slide-in-from-top-1 motion-safe:data-[side=top]:data-open:slide-in-from-bottom-1 data-closed:animate-out data-closed:duration-120 data-closed:ease-exit data-closed:fade-out-0",
					className,
				)}
				{...props}
			/>
		</DropdownMenuPrimitive.Portal>
	);
}

function DropdownMenuRadioGroup({
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) {
	return <DropdownMenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />;
}

/** A row with a check slot on the right, so the labels line up whichever row is chosen. */
function DropdownMenuRadioItem({
	className,
	children,
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
	return (
		<DropdownMenuPrimitive.RadioItem
			data-slot="dropdown-menu-radio-item"
			className={cn(
				"flex h-9 cursor-pointer items-center gap-2 rounded-md px-1.5 text-[14px] leading-[18px] outline-hidden transition-colors duration-150 ease-out select-none focus:bg-muted data-disabled:pointer-events-none data-disabled:opacity-45 data-[state=checked]:font-medium",
				className,
			)}
			{...props}
		>
			<span className="flex-1">{children}</span>
			<span className="size-4 flex-none">
				<DropdownMenuPrimitive.ItemIndicator>
					<Check className="size-4 text-primary" strokeWidth={2.2} />
				</DropdownMenuPrimitive.ItemIndicator>
			</span>
		</DropdownMenuPrimitive.RadioItem>
	);
}

export {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
};
