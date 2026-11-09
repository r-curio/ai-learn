import type { ImageContent, Message, TextContent } from "@earendil-works/pi-ai";
import type { Drawing, DrawingEdit, SceneElement } from "../../shared/drawing.ts";
import type { AttachmentStore } from "../attachments.ts";
import { drawingIn } from "./tools.ts";

const SHAPES = new Set(["rectangle", "ellipse", "diamond"]);
const MOVED_PX = 10;

/** The tutor's own words in the tag, so a label can't close or open a tag. */
const clean = (text: string) => text.replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
const quoted = (text: string) => `"${clean(text)}"`;

/** What's in the edited scene, keyed the way the card names elements: `box-<id>`, `arrow-<n>`. */
function readScene(elements: SceneElement[]) {
	const live = elements.filter((element) => !element.isDeleted);
	const labels = new Map<string, string>();
	for (const element of live)
		if (element.type === "text" && element.containerId)
			labels.set(element.containerId, element.text ?? "");
	const shapes = live.filter(
		(element) => SHAPES.has(element.type) && !element.id.startsWith("group-"),
	);
	const notes = live.filter(
		(element) =>
			element.type === "text" && !element.containerId && !element.id.startsWith("group-"),
	);
	return {
		labels,
		shapes: new Map(shapes.map((shape) => [shape.id, shape])),
		arrows: live.filter((element) => element.type === "arrow"),
		notes,
		freehand: live.filter((element) => element.type === "freedraw").length,
	};
}

type Scene = ReturnType<typeof readScene>;

function boxChanges(drawing: Drawing, scene: Scene, name: (id: string) => string): string[] {
	const changes: string[] = [];
	for (const box of drawing.boxes) {
		const shape = scene.shapes.get(`box-${box.id}`);
		if (!shape) changes.push(`Removed the box ${quoted(box.label)}`);
		else if (clean(name(shape.id)) !== clean(box.label))
			changes.push(`Renamed ${quoted(box.label)} to ${quoted(name(shape.id))}`);
		else if (Math.abs(shape.x - box.x) > MOVED_PX || Math.abs(shape.y - box.y) > MOVED_PX)
			changes.push(`Moved the box ${quoted(box.label)}`);
	}
	for (const id of scene.shapes.keys())
		if (!id.startsWith("box-")) changes.push(`Added a box ${quoted(name(id))}`);
	return changes;
}

/** The box an arrow end is tied to, or failing that the one it was dropped inside. */
function endBox(scene: Scene, arrow: SceneElement, end: "start" | "end"): string {
	const bound = (end === "start" ? arrow.startBinding : arrow.endBinding)?.elementId;
	if (bound && scene.shapes.has(bound)) return bound;
	const points = Array.isArray(arrow.points) ? (arrow.points as [number, number][]) : [];
	const point = end === "start" ? points[0] : points.at(-1);
	if (!point) return "";
	const [x, y] = [arrow.x + point[0], arrow.y + point[1]];
	const inside = [...scene.shapes.values()].find(
		(shape) =>
			x >= shape.x && x <= shape.x + shape.width && y >= shape.y && y <= shape.y + shape.height,
	);
	return inside?.id ?? "";
}

/** Arrows are compared by which boxes they join, so a renamed box doesn't look like a new arrow. */
function arrowKeys(drawing: Drawing, scene: Scene) {
	const before = drawing.arrows.map((arrow) => `box-${arrow.from}>box-${arrow.to}`);
	const after = scene.arrows.map(
		(arrow) => `${endBox(scene, arrow, "start")}>${endBox(scene, arrow, "end")}`,
	);
	return { before, after };
}

function arrowText(key: string, name: (id: string) => string, label?: string): string {
	const [from = "", to = ""] = key.split(">");
	const end = (id: string) => (id ? quoted(name(id)) : "nothing");
	return `${end(from)} → ${end(to)}${label ? ` (${clean(label)})` : ""}`;
}

/** Each key in `keys` that `others` lacks, counting repeats. */
function missingFrom(keys: string[], others: string[]): string[] {
	const left = [...others];
	return keys.filter((key) => {
		const at = left.indexOf(key);
		if (at === -1) return true;
		left.splice(at, 1);
		return false;
	});
}

function describeChanges(
	drawing: Drawing,
	scene: Scene,
	name: (id: string) => string,
	picture: boolean,
) {
	const { before, after } = arrowKeys(drawing, scene);
	return [
		...boxChanges(drawing, scene, name),
		...missingFrom(before, after).map((key) => `Removed the arrow ${arrowText(key, name)}`),
		...missingFrom(after, before).map((key) => `Added an arrow ${arrowText(key, name)}`),
		...scene.notes.map((note) => `Wrote a note: ${quoted(note.text ?? "")}`),
		...(scene.freehand > 0
			? [
					`Drew ${scene.freehand} freehand mark${scene.freehand === 1 ? "" : "s"}${picture ? ", shown in the attached picture" : ""}`,
				]
			: []),
	];
}

/**
 * The `<diagram-edit>` text the tutor reads with the learner's message: what changed, then the
 * drawing as it now stands. The app writes it from the saved drawing and the edited scene.
 */
export function editTag(drawing: Drawing, elements: SceneElement[], picture: boolean): string {
	const scene = readScene(elements);
	const original = new Map(drawing.boxes.map((box) => [`box-${box.id}`, box.label]));
	const name = (id: string) => scene.labels.get(id) || original.get(id) || "an unlabelled box";
	const changes = describeChanges(drawing, scene, name, picture);
	const boxes = [...scene.shapes.keys()].map((id) => quoted(name(id)));
	const { after } = arrowKeys(drawing, scene);
	const arrows = scene.arrows.map((arrow, index) =>
		arrowText(after[index]!, name, scene.labels.get(arrow.id)),
	);
	return [
		`<diagram-edit drawing="${clean(drawing.id)}" title="${clean(drawing.title).replace(/"/g, "'")}">`,
		"The learner edited your drawing. What they changed:",
		...(changes.length > 0 ? changes : ["Nothing that can be put in words"]).map(
			(line) => `- ${line}`,
		),
		`Boxes now: ${boxes.join(", ") || "none"}`,
		`Arrows now: ${arrows.join(", ") || "none"}`,
		"</diagram-edit>",
	].join("\n");
}

/** The drawing a `draw` or `plan` call in this chat made, if it succeeded. */
function drawingFromCall(messages: Message[], callId: string): Drawing | undefined {
	const result = messages.find(
		(message) => message.role === "toolResult" && message.toolCallId === callId,
	);
	return result?.role === "toolResult" ? drawingIn(result) : undefined;
}

/**
 * What the model gets for an edit: a picture of it when there is one and the model can see
 * images, then the tag. Nothing, if the edited drawing isn't in this chat.
 */
export function editContent(
	messages: Message[],
	edit: DrawingEdit,
	attachments: AttachmentStore,
	seesImages: boolean,
): (TextContent | ImageContent)[] | undefined {
	const drawing = drawingFromCall(messages, edit.callId);
	if (!drawing) return undefined;
	const picture =
		seesImages && edit.pictureId
			? attachments.toContent([edit.pictureId]).filter((part) => part.type === "image")
			: [];
	return [...picture, { type: "text", text: editTag(drawing, edit.elements, picture.length > 0) }];
}
