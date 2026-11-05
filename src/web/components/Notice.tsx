import type { ReactNode } from "react";

export function Notice({ error = false, children }: { error?: boolean; children: ReactNode }) {
	return (
		<p
			className={`mt-2 text-[13px] ${error ? "rounded-lg bg-danger-bg px-[11px] py-2 text-danger" : "text-muted"}`}
		>
			{children}
		</p>
	);
}
