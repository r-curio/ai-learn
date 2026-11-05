import { Command as CommandPrimitive } from "cmdk";
import { cn } from "cn";
import { Search } from "lucide-react";
import * as React from "react";

function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
	return (
		<CommandPrimitive data-slot="command" className={cn("flex flex-col", className)} {...props} />
	);
}

function CommandInput({
	className,
	...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
	return (
		<div className="flex h-11 flex-none items-center gap-2 border-b border-border px-3.5">
			<Search className="size-4 flex-none text-muted-foreground" strokeWidth={1.5} />
			<CommandPrimitive.Input
				data-slot="command-input"
				className={cn(
					"min-w-0 flex-1 bg-transparent text-[14px] leading-[18px] outline-hidden placeholder:text-muted-foreground",
					className,
				)}
				{...props}
			/>
		</div>
	);
}

function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
	return (
		<CommandPrimitive.List
			data-slot="command-list"
			className={cn("overflow-y-auto p-1.5", className)}
			{...props}
		/>
	);
}

function CommandEmpty({
	className,
	...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
	return (
		<CommandPrimitive.Empty
			data-slot="command-empty"
			className={cn(
				"flex h-[60px] items-center justify-center text-[13px] leading-4 text-muted-foreground",
				className,
			)}
			{...props}
		/>
	);
}

function CommandGroup({
	className,
	...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
	return (
		<CommandPrimitive.Group
			data-slot="command-group"
			className={cn(
				"not-first:pt-2 **:[[cmdk-group-heading]]:flex **:[[cmdk-group-heading]]:h-7 **:[[cmdk-group-heading]]:items-center **:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:text-[13px] **:[[cmdk-group-heading]]:leading-4 **:[[cmdk-group-heading]]:text-muted-foreground",
				className,
			)}
			{...props}
		/>
	);
}

function CommandItem({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Item>) {
	return (
		<CommandPrimitive.Item
			data-slot="command-item"
			className={cn(
				"flex h-9 cursor-pointer items-center gap-2 rounded-md px-2 text-[14px] leading-[18px] outline-hidden transition-colors duration-150 ease-out select-none data-[selected=true]:bg-muted",
				className,
			)}
			{...props}
		/>
	);
}

export { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem };
