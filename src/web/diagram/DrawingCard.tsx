import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { Pencil } from "lucide-react";
import { lazy, Suspense, useMemo, type WheelEvent } from "react";
import type { Drawing, SceneElement } from "../../shared/drawing.ts";
import { Button } from "../components/button.tsx";
import { Skeleton } from "../components/skeleton.tsx";
import { boundsOf, type SceneSource } from "./sceneSetup.ts";
import { toExcalidraw } from "./toExcalidraw.ts";

declare global {
	interface Window {
		EXCALIDRAW_ASSET_PATH?: string;
	}
}

/**
 * Excalidraw reads where its fonts are as it loads, so this is set first. The app serves them,
 * and the content security policy blocks Excalidraw's CDN fallback.
 */
export function loadExcalidraw<T>(load: () => Promise<T>): () => Promise<T> {
	return () => {
		window.EXCALIDRAW_ASSET_PATH = "/excalidraw/";
		return load();
	};
}

const DrawingScene = lazy(loadExcalidraw(() => import("./DrawingScene.tsx")));

const MIN_HEIGHT = 220;
const MAX_HEIGHT = 440;

/** The canvas would otherwise catch the wheel, and the chat would stop scrolling over a drawing. */
const passWheelToChat = (event: WheelEvent) => {
	if (!event.ctrlKey && !event.metaKey) event.stopPropagation();
};

function DrawingFrame(props: {
	title: string;
	caption: string;
	source: SceneSource;
	onEdit?: () => void;
}) {
	const { title, caption, source, onEdit } = props;
	const height = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, source.bounds.height + 40));
	return (
		<figure className="w-full overflow-hidden rounded-xl border border-border bg-card">
			<figcaption className="flex items-center gap-2 border-b border-border py-2 pr-2 pl-4">
				<span className="truncate text-sm leading-[18px] font-medium">{title}</span>
				<span className="flex-1 text-[13px] leading-4 text-muted-foreground">{caption}</span>
				{onEdit && (
					<Button
						variant="outline"
						className="h-7 px-2.5 py-0 text-[13px] leading-[18px] font-medium text-foreground"
						onClick={onEdit}
					>
						<Pencil className="size-3.5" strokeWidth={1.5} />
						Edit
					</Button>
				)}
			</figcaption>
			<div style={{ height }} onWheelCapture={passWheelToChat}>
				<Suspense fallback={<Skeleton className="size-full rounded-none" />}>
					<DrawingScene source={source} />
				</Suspense>
			</div>
		</figure>
	);
}

/** A drawing the tutor made, shown where it was drawn. `version` counts drawings with the same id. */
export function DrawingCard(props: { drawing: Drawing; version: number; onEdit?: () => void }) {
	const { drawing, version, onEdit } = props;
	const source = useMemo(
		() => ({
			make: () => toExcalidraw(drawing),
			bounds: { x: 0, y: 0, width: drawing.width, height: drawing.height },
		}),
		[drawing],
	);
	const kind = drawing.kind === "plan" ? "Lesson plan" : "Diagram";
	const caption = version > 1 ? `${kind}, version ${version}` : kind;
	return <DrawingFrame title={drawing.title} caption={caption} source={source} onEdit={onEdit} />;
}

/** The learner's edit of a drawing, as they sent it. */
export function EditedDrawingCard({
	title,
	elements,
}: {
	title: string;
	elements: SceneElement[];
}) {
	const source = useMemo(
		() => ({
			make: () => elements as unknown as ExcalidrawElement[],
			bounds: boundsOf(elements),
		}),
		[elements],
	);
	return <DrawingFrame title={title} caption="Your edit" source={source} />;
}
