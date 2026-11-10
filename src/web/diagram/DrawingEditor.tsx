import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { lazy, Suspense } from "react";
import { Button } from "../components/button.tsx";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "../components/sheet.tsx";
import { Skeleton } from "../components/skeleton.tsx";
import { loadExcalidraw, useCanvasDone, type FinishedEdit } from "./sceneSetup.ts";

const EditorCanvas = lazy(loadExcalidraw(() => import("./EditorCanvas.tsx")));

/**
 * The full-size editor, opened by Expand on a card being edited. Done hands the edit back, and
 * Cancel goes back to the card. Nothing is sent until the learner sends a message.
 */
export function DrawingEditor(props: {
	title?: string;
	initial?: () => ExcalidrawElement[];
	onCancel: () => void;
	onDone: (edit: FinishedEdit) => void;
}) {
	const { title, initial, onCancel, onDone } = props;
	const { saving, done, onReady } = useCanvasDone(onDone);
	return (
		<Sheet open={Boolean(initial)} onOpenChange={(open) => !open && onCancel()}>
			<SheetContent
				side="right"
				showCloseButton={false}
				// Escape ends typing in a label, so it mustn't also throw the edit away.
				onEscapeKeyDown={(event) => event.preventDefault()}
				className="w-[min(1200px,94vw)] gap-0 data-[side=right]:sm:max-w-none"
			>
				<SheetHeader className="flex-row items-center gap-3 border-b border-border">
					<div className="flex min-w-0 flex-1 flex-col gap-0.5">
						<SheetTitle className="truncate">Edit {title}</SheetTitle>
						<SheetDescription>
							Change anything. The tutor sees what you changed when you send your next message.
						</SheetDescription>
					</div>
					<Button variant="outline" onClick={onCancel}>
						Cancel
					</Button>
					<Button onClick={() => void done()} disabled={saving}>
						Done
					</Button>
				</SheetHeader>
				<div className="relative min-h-0 flex-1">
					{initial && (
						<Suspense fallback={<Skeleton className="size-full rounded-none" />}>
							<EditorCanvas initial={initial} onReady={onReady} />
						</Suspense>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}
