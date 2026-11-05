import type { ComponentProps } from "react";

const variants = {
	primary: "border-transparent bg-accent font-[550] text-accent-ink",
	quiet: "border-line bg-transparent text-muted enabled:hover:text-ink",
	inline: "border-transparent underline",
};

const sizes = {
	md: "px-[13px] py-[5px] text-[14px]",
	sm: "px-[9px] py-[3px] text-[13px]",
	xs: "px-[9px] py-[2px] text-[13px]",
	inline: "pl-2",
};

interface ButtonProps extends ComponentProps<"button"> {
	variant: keyof typeof variants;
	size?: keyof typeof sizes;
}

export function Button({ variant, size = "md", className = "", ...props }: ButtonProps) {
	return (
		<button
			type="button"
			className={`rounded-lg border ${variants[variant]} ${sizes[size]} ${className}`}
			{...props}
		/>
	);
}
