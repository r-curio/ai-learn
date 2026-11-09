import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { useCallback, useState } from "react";
import type { Drawing, DrawingEdit, SceneElement } from "../../shared/drawing.ts";
import { uploadAttachment } from "../api.ts";
import type { FinishedEdit } from "./EditorCanvas.tsx";
import { toExcalidraw } from "./toExcalidraw.ts";

/** An edit waiting in the composer. It goes with the learner's next message. */
export interface EditDraft {
	callId: string;
	title: string;
	elements: SceneElement[];
	state: "uploading" | "ready" | "failed";
	pictureId?: string;
	error?: string;
}

interface Editing {
	sessionId: string;
	callId: string;
	drawing: Drawing;
}

/** Editing one of the tutor's drawings: the open editor, then the edit waiting to be sent. */
export function useDrawingEdit() {
	const [editing, setEditing] = useState<Editing>();
	const [draft, setDraft] = useState<EditDraft>();

	/** Picking up where the learner left off, if they're editing the same drawing again. */
	const initial = editing
		? (): ExcalidrawElement[] =>
				draft?.callId === editing.callId
					? (draft.elements as unknown as ExcalidrawElement[])
					: toExcalidraw(editing.drawing, { bind: true })
		: undefined;

	const done = ({ elements, picture }: FinishedEdit) => {
		if (!editing) return;
		const { sessionId, callId, drawing } = editing;
		setEditing(undefined);
		setDraft({ callId, title: drawing.title, elements, state: picture ? "uploading" : "ready" });
		if (!picture) return;
		const file = new File([picture], `${drawing.title} (edited).png`, { type: "image/png" });
		uploadAttachment(sessionId, file)
			.then((info) =>
				setDraft((current) =>
					current?.elements === elements
						? { ...current, state: "ready", pictureId: info.id }
						: current,
				),
			)
			.catch((cause: Error) =>
				setDraft((current) =>
					current?.elements === elements
						? { ...current, state: "failed", error: cause.message }
						: current,
				),
			);
	};

	const clear = useCallback(() => {
		setEditing(undefined);
		setDraft(undefined);
	}, []);

	const { callId, title, elements, pictureId } = draft ?? {};
	const edit: (DrawingEdit & { title: string }) | undefined =
		draft?.state === "ready"
			? { callId: callId!, title: title!, elements: elements!, pictureId }
			: undefined;

	return {
		draft,
		edit,
		uploading: draft?.state === "uploading",
		start: (sessionId: string, callId: string, drawing: Drawing) =>
			setEditing({ sessionId, callId, drawing }),
		editor: {
			title: editing?.drawing.title,
			initial,
			onCancel: () => setEditing(undefined),
			onDone: done,
		},
		remove: () => setDraft(undefined),
		clear,
	};
}
