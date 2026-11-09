import { useEffect, useState, useSyncExternalStore } from "react";
import { Kbd } from "../components/kbd.tsx";

/** Frame 06's composer pill and frame 21's answer field. Resting heights stand in under reduced motion. */
const SIZES = {
	small: { bar: 2, step: 5, tallest: 16, resting: [6, 12, 16, 9, 13] },
	large: { bar: 3, step: 6, tallest: 18, resting: [8, 16, 11, 18, 6] },
};
const SHORTEST = 4;

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribe = (change: () => void) => {
	const query = matchMedia(REDUCED);
	query.addEventListener("change", change);
	return () => query.removeEventListener("change", change);
};
const useReducedMotion = () => useSyncExternalStore(subscribe, () => matchMedia(REDUCED).matches);

/** Five bars that follow how loud the learner is, newest on the right. */
export function Waveform({ levels, size }: { levels: number[]; size: keyof typeof SIZES }) {
	const { bar, step, tallest, resting } = SIZES[size];
	const still = useReducedMotion();
	const heights = still
		? resting
		: levels.map((level) => Math.round(SHORTEST + (tallest - SHORTEST) * Math.sqrt(level)));
	const width = step * (heights.length - 1) + bar;
	return (
		<svg
			width={width}
			height={tallest}
			viewBox={`0 0 ${width} ${tallest}`}
			aria-hidden="true"
			className="flex-none fill-destructive"
		>
			{heights.map((height, index) => (
				<rect
					key={index}
					x={index * step}
					y={(tallest - height) / 2}
					width={bar}
					height={height}
					rx={bar / 2}
				/>
			))}
		</svg>
	);
}

export function Timer({ startedAt }: { startedAt: number }) {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const tick = setInterval(() => setNow(Date.now()), 250);
		return () => clearInterval(tick);
	}, []);
	const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
	const shown = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
	return <span className="text-[13px] leading-4 text-foreground tabular-nums">{shown}</span>;
}

/** Frame 21: what's being heard, for how long, and the key that stops it. */
export function RecordingIndicator({ levels, startedAt }: { levels: number[]; startedAt: number }) {
	return (
		<div className="flex flex-none items-center gap-2.5" role="status" aria-label="Recording">
			<Waveform levels={levels} size="large" />
			<Timer startedAt={startedAt} />
			<Kbd className="h-[22px] rounded-xs border border-border bg-transparent px-2 font-normal">
				Release
			</Kbd>
		</div>
	);
}
