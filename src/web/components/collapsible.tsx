import { Collapsible as CollapsiblePrimitive } from "radix-ui";
import { cn } from "cn";

function Collapsible({ ...props }: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
	return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
}

function CollapsibleTrigger({
	...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleTrigger>) {
	return <CollapsiblePrimitive.CollapsibleTrigger data-slot="collapsible-trigger" {...props} />;
}

/** Opens at `base` and closes at `exit`. Reduced motion skips the size change, per DESIGN.md. */
function CollapsibleContent({
	className,
	...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleContent>) {
	return (
		<CollapsiblePrimitive.CollapsibleContent
			data-slot="collapsible-content"
			className={cn(
				"overflow-hidden motion-safe:data-[state=closed]:animate-collapsible-up motion-safe:data-[state=closed]:duration-120 motion-safe:data-[state=closed]:ease-[var(--ease-exit)] motion-safe:data-[state=open]:animate-collapsible-down motion-safe:data-[state=open]:duration-200 motion-safe:data-[state=open]:ease-[var(--ease-fluid)]",
				className,
			)}
			{...props}
		/>
	);
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
