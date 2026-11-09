import { lazy, Suspense, type WheelEvent } from "react";
import type { Drawing } from "../../shared/drawing.ts";
import { Skeleton } from "../components/skeleton.tsx";

declare global {
	interface Window {
		EXCALIDRAW_ASSET_PATH?: string;
	}
}

/**
 * Excalidraw reads where its fonts are as it loads, so this is set first. The app serves them,
 * and the content security policy blocks Excalidraw's CDN fallback.
 */
const DrawingScene = lazy(() => {
	window.EXCALIDRAW_ASSET_PATH = "/excalidraw/";
	return import("./DrawingScene.tsx");
});

const MIN_HEIGHT = 220;
const MAX_HEIGHT = 440;

/** The canvas would otherwise catch the wheel, and the chat would stop scrolling over a drawing. */
const passWheelToChat = (event: WheelEvent) => {
	if (!event.ctrlKey && !event.metaKey) event.stopPropagation();
};

/** A drawing the tutor made, shown where it was drawn. `version` counts drawings with the same id. */
export function DrawingCard({ drawing, version }: { drawing: Drawing; version: number }) {
	const caption = drawing.kind === "plan" ? "Lesson plan" : "Diagram";
	const height = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, drawing.height + 40));
	return (
		<figure className="overflow-hidden rounded-xl border border-border bg-card">
			<figcaption className="flex items-baseline gap-2 border-b border-border px-4 py-2.5">
				<span className="text-sm leading-[18px] font-medium">{drawing.title}</span>
				<span className="text-[13px] leading-4 text-muted-foreground">
					{version > 1 ? `${caption}, version ${version}` : caption}
				</span>
			</figcaption>
			<div style={{ height }} onWheelCapture={passWheelToChat}>
				<Suspense fallback={<Skeleton className="size-full rounded-none" />}>
					<DrawingScene drawing={drawing} />
				</Suspense>
			</div>
		</figure>
	);
}
