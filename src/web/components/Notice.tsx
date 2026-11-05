import type { ReactNode } from "react";
import { Alert, AlertDescription } from "./alert.tsx";

/** One caption line about a reply or the app, muted or in red, with room for a button beside it. */
export function Notice({
	error = false,
	action,
	children,
}: {
	error?: boolean;
	action?: ReactNode;
	children: ReactNode;
}) {
	return (
		<Alert
			variant={error ? "destructive" : "default"}
			role={error ? "alert" : undefined}
			className="flex flex-wrap items-center gap-2.5 rounded-none border-0 bg-transparent p-0"
		>
			<AlertDescription className="min-w-0 text-[13px] leading-[18px] text-wrap md:text-wrap">
				{children}
			</AlertDescription>
			{action}
		</Alert>
	);
}
