import { Badge } from "../components/badge.tsx";

export function SentFile({ name }: { name: string }) {
	return (
		<Badge
			variant="outline"
			className="block h-auto w-auto overflow-visible rounded-[7px] bg-background px-[9px] py-[5px] text-[13px] font-normal wrap-anywhere whitespace-normal"
		>
			{name}
		</Badge>
	);
}
