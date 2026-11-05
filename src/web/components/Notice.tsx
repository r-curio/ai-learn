import type { ReactNode } from "react";
import { Alert, AlertDescription } from "./alert.tsx";

export function Notice({ error = false, children }: { error?: boolean; children: ReactNode }) {
	if (!error) return <p className="mt-2 text-[13px] text-muted-foreground">{children}</p>;
	return (
		<Alert variant="destructive" className="mt-2 block border-0 px-[11px] py-2 text-[13px]">
			<AlertDescription className="text-[13px] text-wrap md:text-wrap">{children}</AlertDescription>
		</Alert>
	);
}
