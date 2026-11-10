import { convertToExcalidrawElements, FONT_FAMILY } from "@excalidraw/excalidraw";
import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/data/transform";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { Drawing, DrawingArrow } from "../../shared/drawing.ts";

/** A drawing's colours, from the `--diagram-*` tokens in globals.css. */
function diagramColours() {
	const styles = getComputedStyle(document.documentElement);
	const token = (name: string) => styles.getPropertyValue(`--diagram-${name}`).trim();
	return {
		stroke: token("stroke"),
		fill: token("fill"),
		group: token("group"),
		text: token("text"),
	};
}
export const FONT_NAME = "Excalifont";
const FONT = { fontFamily: FONT_FAMILY[FONT_NAME], fontSize: 16 };

/** A stable number from a string, so the hand-drawn strokes are the same every time a drawing loads. */
function seedOf(text: string): number {
	let hash = 2166136261;
	for (let index = 0; index < text.length; index++)
		hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
	return (hash >>> 0) % 2 ** 31;
}

function arrowSkeleton(
	arrow: DrawingArrow,
	index: number,
	stroke: string,
): ExcalidrawElementSkeleton | [] {
	const [start, ...rest] = arrow.points;
	if (!start || rest.length === 0) return [];
	const [x, y] = start;
	return {
		type: "arrow",
		id: `arrow-${index}`,
		x,
		y,
		points: arrow.points.map(([px, py]) => [px - x, py - y] as const) as never,
		strokeColor: stroke,
		roundness: null,
		...(arrow.label ? { label: { text: arrow.label, ...FONT, fontSize: 14 } } : {}),
	};
}

function skeletons(drawing: Drawing): ExcalidrawElementSkeleton[] {
	const colour = diagramColours();
	const groups = drawing.groups.flatMap((group): ExcalidrawElementSkeleton[] => [
		{
			type: "rectangle",
			id: `group-${group.id}`,
			x: group.x,
			y: group.y,
			width: group.width,
			height: group.height,
			strokeColor: colour.group,
			strokeStyle: "dashed",
			roundness: { type: 3 },
		},
		{
			type: "text",
			id: `group-${group.id}-label`,
			x: group.x + 16,
			y: group.y + 12,
			text: group.label,
			strokeColor: colour.group,
			...FONT,
		},
	]);
	const boxes = drawing.boxes.map((box): ExcalidrawElementSkeleton => ({
		type: "rectangle",
		id: `box-${box.id}`,
		x: box.x,
		y: box.y,
		width: box.width,
		height: box.height,
		strokeColor: colour.stroke,
		backgroundColor: colour.fill,
		fillStyle: "solid",
		roundness: { type: 3 },
		label: { text: box.label, strokeColor: colour.text, ...FONT },
	}));
	return [
		...groups,
		...boxes,
		...drawing.arrows.flatMap((arrow, index) => arrowSkeleton(arrow, index, colour.stroke)),
	];
}

/** Excalidraw gives labels random ids, so they're renamed after their container. */
function withStableIds(elements: readonly ExcalidrawElement[]): ExcalidrawElement[] {
	const renamed = new Map<string, string>();
	for (const element of elements)
		if (element.type === "text" && element.containerId)
			renamed.set(element.id, `${element.containerId}-label`);
	return elements.map((element) => {
		const id = renamed.get(element.id) ?? element.id;
		return {
			...element,
			id,
			seed: seedOf(id),
			versionNonce: seedOf(`${id}/version`),
			updated: 0,
			boundElements:
				element.boundElements?.map((bound) => ({
					...bound,
					id: renamed.get(bound.id) ?? bound.id,
				})) ?? null,
		};
	});
}

/** The saved layout as Excalidraw elements. The same drawing always gives the same elements. */
export function toExcalidraw(drawing: Drawing): ExcalidrawElement[] {
	return withStableIds(convertToExcalidrawElements(skeletons(drawing), { regenerateIds: false }));
}
