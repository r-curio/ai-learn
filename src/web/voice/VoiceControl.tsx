import { LoaderCircle, Mic } from "lucide-react";
import { Button } from "../components/button.tsx";
import { IconButton } from "../components/IconButton.tsx";
import { Timer, Waveform } from "./RecordingIndicator.tsx";
import type { VoiceRecorder } from "./useVoiceRecorder.ts";

/** The mic button, which becomes frame 06's red pill while recording. Pressing the pill stops. */
export function VoiceControl({ voice, disabled }: { voice: VoiceRecorder; disabled: boolean }) {
	if (voice.phase === "recording")
		return (
			<Button
				variant="outline"
				size="icon"
				aria-label="Stop recording"
				className="h-8 w-[110px] justify-between rounded-2xl border-destructive px-3 hover:bg-destructive-muted"
				onClick={() => void voice.stop()}
			>
				<Waveform levels={voice.levels} size="small" />
				<Timer startedAt={voice.startedAt} />
				<span className="size-2.5 rounded-[2px] bg-destructive" />
			</Button>
		);
	const waiting = voice.phase !== "idle";
	const label = {
		idle: "Speak a message",
		starting: "Starting the microphone",
		finishing: "Getting the last words",
	}[voice.phase];
	return (
		<IconButton
			aria-label={label}
			className="size-8 p-0"
			disabled={disabled || waiting}
			onClick={() => void voice.start()}
		>
			{waiting ? (
				<LoaderCircle className="size-5 motion-safe:animate-spin" strokeWidth={1.5} />
			) : (
				<Mic className="size-5" strokeWidth={1.5} />
			)}
		</IconButton>
	);
}
