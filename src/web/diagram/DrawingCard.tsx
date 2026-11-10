import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { Maximize2, Pencil } from "lucide-react";
import { lazy, Suspense, useMemo, type ReactNode, type WheelEvent } from "react";
import type { Drawing, SceneElement } from "../../shared/drawing.ts";
import { Button } from "../components/button.tsx";
import { Skeleton } from "../components/skeleton.tsx";
import { boundsOf, loadExcalidraw, useCanvasDone, type SceneSource } from "./sceneSetup.ts";
import { toExcalidraw } from "./toExcalidraw.ts";
import type { CardEdit } from "./useDrawingEdit.ts";

const DrawingScene = lazy(loadExcalidraw(() => import("./DrawingScene.tsx")));
const EditorCanvas = lazy(loadExcalidraw(() => import("./EditorCanvas.tsx")));

const MIN_HEIGHT = 220;
const MAX_HEIGHT = 440;
/** Editing needs room for Excalidraw's toolbar above the drawing. */
const EDIT_MIN_HEIGHT = 380;

/** The canvas would otherwise catch the wheel, and the chat would stop scrolling over a drawing. */
const passWheelToChat = (event: WheelEvent) => {
	if (!event.ctrlKey && !event.metaKey) event.stopPropagation();
};

const headerButton = "h-7 px-2.5 py-0 text-[13px] leading-[18px] font-medium";

function DrawingFrame(props: {
	title: string;
	caption: string;
	height: number;
	actions?: ReactNode;
	children: ReactNode;
}) {
	return (
		<figure className="w-full overflow-hidden rounded-xl border border-border bg-card">
			<figcaption className="flex items-center gap-2 border-b border-border py-2 pr-2 pl-4">
				<span className="truncate text-sm leading-[18px] font-medium">{props.title}</span>
				<span className="flex-1 text-[13px] leading-4 text-muted-foreground">{props.caption}</span>
				{props.actions}
			</figcaption>
			<div className="relative" style={{ height: props.height }} onWheelCapture={passWheelToChat}>
				<Suspense fallback={<Skeleton className="size-full rounded-none" />}>
					{props.children}
				</Suspense>
			</div>
		</figure>
	);
}

/** Expand, Cancel and Done, with the editing canvas in the card. */
function CardEditor(props: { title: string; height: number; edit: CardEdit }) {
	const { edit } = props;
	const { handle, saving, done, onReady } = useCanvasDone(edit.onDone);
	const expand = () => {
		if (handle.current) edit.onExpand(handle.current.elements());
	};
	const actions = (
		<>
			<Button variant="ghost" className={headerButton} onClick={expand} disabled={saving}>
				<Maximize2 className="size-3.5" strokeWidth={1.5} />
				Expand
			</Button>
			<Button variant="outline" className={headerButton} onClick={edit.onCancel}>
				Cancel
			</Button>
			<Button className={headerButton} onClick={() => void done()} disabled={saving}>
				Done
			</Button>
		</>
	);
	return (
		<DrawingFrame
			title={props.title}
			caption="Editing"
			height={Math.max(EDIT_MIN_HEIGHT, props.height)}
			actions={actions}
		>
			<EditorCanvas initial={edit.initial} onReady={onReady} />
		</DrawingFrame>
	);
}

const frameHeight = (source: SceneSource) =>
	Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, source.bounds.height + 40));

/**
 * A drawing the tutor made, shown where it was drawn, and edited there while `editing` is set.
 * `version` counts drawings with the same id.
 */
export function DrawingCard(props: {
	drawing: Drawing;
	version: number;
	onEdit?: () => void;
	editing?: CardEdit;
}) {
	const { drawing, version, onEdit, editing } = props;
	const source = useMemo(
		() => ({
			make: () => toExcalidraw(drawing),
			bounds: { x: 0, y: 0, width: drawing.width, height: drawing.height },
		}),
		[drawing],
	);
	if (editing)
		return <CardEditor title={drawing.title} height={frameHeight(source)} edit={editing} />;
	const kind = drawing.kind === "plan" ? "Lesson plan" : "Diagram";
	const caption = version > 1 ? `${kind}, version ${version}` : kind;
	const actions = onEdit && (
		<Button variant="outline" className={`${headerButton} text-foreground`} onClick={onEdit}>
			<Pencil className="size-3.5" strokeWidth={1.5} />
			Edit
		</Button>
	);
	return (
		<DrawingFrame
			title={drawing.title}
			caption={caption}
			height={frameHeight(source)}
			actions={actions}
		>
			<DrawingScene source={source} />
		</DrawingFrame>
	);
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
	return (
		<DrawingFrame title={title} caption="Your edit" height={frameHeight(source)}>
			<DrawingScene source={source} />
		</DrawingFrame>
	);
}
