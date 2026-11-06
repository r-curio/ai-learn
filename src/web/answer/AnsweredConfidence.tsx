/** How sure the learner was, beside their answer in the transcript. */
export function AnsweredConfidence({ confidence }: { confidence: number }) {
	return (
		<div className="flex flex-none items-center gap-2">
			<span className="text-[12px] leading-4 whitespace-nowrap text-muted-foreground tabular-nums">
				{confidence}% sure
			</span>
			<div className="h-[3px] w-14 flex-none overflow-hidden rounded-full bg-foreground/15">
				<div className="h-full rounded-full bg-primary" style={{ width: `${confidence}%` }} />
			</div>
		</div>
	);
}
