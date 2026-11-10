import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { useCallback, useState } from "react";
import type { Drawing, DrawingEdit, SceneElement } from "../../shared/drawing.ts";
import { uploadAttachment } from "../api.ts";
import type { FinishedEdit } from "./sceneSetup.ts";
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

/** A card being edited in place. */
export interface CardEdit {
	callId: string;
	initial: () => ExcalidrawElement[];
	onDone: (edit: FinishedEdit) => void;
	onCancel: () => void;
	/** Moves the edit, with the changes so far, into the full-size editor. */
	onExpand: (elements: SceneElement[]) => void;
}

interface Editing {
	sessionId: string;
	callId: string;
	drawing: Drawing;
	/** True while the edit is in the full-size editor rather than its card. */
	expanded: boolean;
	/** The changes Expand carried over. Cancel in the full-size editor goes back to these. */
	carried?: SceneElement[];
}

/** Excalidraw changes elements in place, so a cancelled change mustn't reach saved elements. */
const copy = (elements: SceneElement[]) =>
	structuredClone(elements) as unknown as ExcalidrawElement[];

/** Editing one of the tutor's drawings, in its card or full size, then the edit waiting to be sent. */
export function useDrawingEdit() {
	const [editing, setEditing] = useState<Editing>();
	const [draft, setDraft] = useState<EditDraft>();

	/** Picking up where the learner left off: Expand's changes, or a waiting edit of the same drawing. */
	const initial = (current: Editing) => (): ExcalidrawElement[] => {
		if (current.carried) return copy(current.carried);
		if (draft?.callId === current.callId) return copy(draft.elements);
		return toExcalidraw(current.drawing, { bind: true });
	};

	const done = ({ elements, picture }: FinishedEdit) => {
		if (!editing) return;
		const { sessionId, callId, drawing } = editing;
		setEditing(undefined);
		setDraft({ callId, title: drawing.title, elements, state: picture ? "uploading" : "ready" });
		if (!picture) return;
		const file = new File([picture], `${drawing.title} (edited).png`, { type: "image/png" });
		const settle = (change: Partial<EditDraft>) =>
			setDraft((current) => (current?.elements === elements ? { ...current, ...change } : current));
		uploadAttachment(sessionId, file)
			.then((info) => settle({ state: "ready", pictureId: info.id }))
			.catch((cause: Error) => settle({ state: "failed", error: cause.message }));
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

	const card: CardEdit | undefined =
		editing && !editing.expanded
			? {
					callId: editing.callId,
					initial: initial(editing),
					onDone: done,
					onCancel: () => setEditing(undefined),
					onExpand: (carried) => setEditing({ ...editing, carried, expanded: true }),
				}
			: undefined;

	return {
		draft,
		edit,
		uploading: draft?.state === "uploading",
		/** An edit is open, in a card or full size, and isn't in the composer yet. */
		editing: Boolean(editing),
		start: (sessionId: string, callId: string, drawing: Drawing) =>
			setEditing({ sessionId, callId, drawing, expanded: false }),
		card,
		editor: {
			title: editing?.drawing.title,
			initial: editing?.expanded ? initial(editing) : undefined,
			onCancel: () => setEditing((current) => current && { ...current, expanded: false }),
			onDone: done,
		},
		remove: () => setDraft(undefined),
		clear,
	};
}
