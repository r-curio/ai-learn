import { LoaderCircle, Mic } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "../components/button.tsx";
import { IconButton } from "../components/IconButton.tsx";
import type { VoiceRecorder } from "./useVoiceRecorder.ts";

/** Frame 06's bar heights, which also stand still in place of live ones under reduced motion. */
const RESTING = [6, 12, 16, 9, 13];
const SHORTEST = 4;
const TALLEST = 16;

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribe = (change: () => void) => {
	const query = matchMedia(REDUCED);
	query.addEventListener("change", change);
	return () => query.removeEventListener("change", change);
};
const useReducedMotion = () => useSyncExternalStore(subscribe, () => matchMedia(REDUCED).matches);

/** Five bars that follow how loud the learner is, newest on the right. */
function Waveform({ levels }: { levels: number[] }) {
	const still = useReducedMotion();
	const heights = still
		? RESTING
		: levels.map((level) => Math.round(SHORTEST + (TALLEST - SHORTEST) * Math.sqrt(level)));
	return (
		<svg width="22" height="16" viewBox="0 0 22 16" aria-hidden="true" className="fill-destructive">
			{heights.map((height, index) => (
				<rect key={index} x={index * 5} y={(16 - height) / 2} width="2" height={height} rx="1" />
			))}
		</svg>
	);
}

function Timer({ startedAt }: { startedAt: number }) {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const tick = setInterval(() => setNow(Date.now()), 250);
		return () => clearInterval(tick);
	}, []);
	const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
	const shown = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
	return <span className="text-[13px] leading-4 text-foreground tabular-nums">{shown}</span>;
}

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
				<Waveform levels={voice.levels} />
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
