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
