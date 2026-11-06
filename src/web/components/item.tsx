import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";

const itemVariants = cva(
	"group/item flex w-full flex-wrap items-center rounded-lg border text-sm transition-colors duration-150 outline-none",
	{
		variants: {
			variant: {
				default: "border-transparent",
				outline: "border-border",
				muted: "border-transparent bg-muted/50",
			},
			size: {
				default: "gap-2.5 px-3 py-2.5",
				sm: "gap-2.5 px-3 py-2.5",
				xs: "gap-2 px-2.5 py-2",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

function Item({
	className,
	variant = "default",
	size = "default",
	asChild = false,
	...props
}: ComponentProps<"div"> & VariantProps<typeof itemVariants> & { asChild?: boolean }) {
	const Comp = asChild ? Slot.Root : "div";
	return (
		<Comp
			data-slot="item"
			data-variant={variant}
			data-size={size}
			className={cn(itemVariants({ variant, size, className }))}
			{...props}
		/>
	);
}

function ItemMedia({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="item-media"
			className={cn("flex shrink-0 items-center justify-center", className)}
			{...props}
		/>
	);
}

function ItemContent({ className, ...props }: ComponentProps<"div">) {
	return (
		<div data-slot="item-content" className={cn("flex flex-1 flex-col", className)} {...props} />
	);
}

export { Item, ItemContent, ItemMedia };
