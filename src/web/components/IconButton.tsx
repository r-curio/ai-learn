import type { ComponentProps } from "react";

interface IconButtonProps extends ComponentProps<"button"> {
	/** What the button does, since its visible content is only a symbol. */
	"aria-label": string;
}

export function IconButton({ className = "", ...props }: IconButtonProps) {
	return (
		<button
			type="button"
			className={`flex-none rounded-lg border border-transparent py-0.5 leading-none text-muted ${className}`}
			{...props}
		/>
	);
}
