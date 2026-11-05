import { cn } from "cn";
import type { ComponentProps } from "react";
import { Button } from "./button.tsx";

interface IconButtonProps extends ComponentProps<typeof Button> {
	/** What the button does, since its visible content is only a symbol. */
	"aria-label": string;
}

export function IconButton({ className, ...props }: IconButtonProps) {
	return (
		<Button
			variant="ghost"
			size="icon"
			className={cn("flex-none text-muted-foreground", className)}
			{...props}
		/>
	);
}
