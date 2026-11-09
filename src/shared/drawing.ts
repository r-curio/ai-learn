/** A drawing the tutor made, laid out by the app. Positions are saved, so a reopened chat shows the same picture. */

export type DrawingKind = "diagram" | "plan";

export interface DrawingBox {
	id: string;
	label: string;
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface DrawingArrow {
	from: string;
	to: string;
	label?: string;
	/** From the edge of `from` to the edge of `to`, with any bends between. */
	points: [number, number][];
}

/** A frame around boxes that belong together, with its label at the top. */
export type DrawingGroup = DrawingBox;

export interface Drawing {
	/** Drawing again with the same id makes a new version of it. The plan's id is always `plan`. */
	id: string;
	kind: DrawingKind;
	title: string;
	width: number;
	height: number;
	boxes: DrawingBox[];
	arrows: DrawingArrow[];
	groups: DrawingGroup[];
}

/** One element of an Excalidraw scene, as saved. Only the fields the app reads are named. */
export interface SceneElement {
	id: string;
	type: string;
	x: number;
	y: number;
	width: number;
	height: number;
	isDeleted?: boolean;
	text?: string;
	containerId?: string | null;
	startBinding?: { elementId: string } | null;
	endBinding?: { elementId: string } | null;
	[key: string]: unknown;
}

/** A learner's edit of one of the tutor's drawings, sent with their next message. */
export interface DrawingEdit {
	/** The `draw` or `plan` call that made the version they edited. */
	callId: string;
	elements: SceneElement[];
	/** A picture of the edit, uploaded as an attachment, when it has freehand marks. */
	pictureId?: string;
}
