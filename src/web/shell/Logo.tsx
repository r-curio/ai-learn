/** The ai-learn mark. Its colours follow the theme, so it inverts in dark mode. */
export function Logo() {
	return (
		<svg className="flex-none" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
			<rect className="fill-primary" width="24" height="24" rx="7" />
			<g className="fill-primary-foreground stroke-primary-foreground">
				<path
					d="M12 6.5L6.5 17M12 6.5L17.5 17M8.7 13h6.6"
					fill="none"
					strokeWidth="1.5"
					strokeLinecap="round"
				/>
				<circle cx="12" cy="6.5" r="1.9" stroke="none" />
				<circle cx="6.5" cy="17" r="1.9" stroke="none" />
				<circle cx="17.5" cy="17" r="1.9" stroke="none" />
			</g>
		</svg>
	);
}
