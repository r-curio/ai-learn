import { cn } from "cn";
import * as React from "react";

function Input({ className, ...props }: React.ComponentProps<"input">) {
	return (
		<input
			data-slot="input"
			className={cn(
				"h-9 w-full min-w-0 rounded-md border border-input bg-card px-2.5 text-[14px] leading-[18px] outline-hidden transition-colors duration-150 ease-out placeholder:text-muted-foreground focus-visible:border-muted-foreground disabled:opacity-45",
				className,
			)}
			{...props}
		/>
	);
}

export { Input };
