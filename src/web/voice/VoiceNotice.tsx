import { Button } from "../components/button.tsx";
import { Notice } from "../components/Notice.tsx";
import type { VoiceRecorder } from "./useVoiceRecorder.ts";

/** Why voice didn't work. Set-up problems are muted, with a way to Settings, and failures are red. */
export function VoiceNotice({
	voice,
	onOpenSettings,
	className,
}: {
	voice: VoiceRecorder;
	className?: string;
	onOpenSettings: () => void;
}) {
	const { problem } = voice;
	if (!problem) return null;
	const action = problem.settings ? (
		<Button variant="outline" size="xs" onClick={onOpenSettings}>
			Open Voice settings
		</Button>
	) : undefined;
	return (
		<div className={className}>
			<Notice error={!problem.settings} action={action}>
				{problem.message}
			</Notice>
		</div>
	);
}
