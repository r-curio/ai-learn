import ELK, { type ElkExtendedEdge, type ElkNode } from "elkjs/lib/elk.bundled.js";
import type {
	Drawing,
	DrawingArrow,
	DrawingBox,
	DrawingGroup,
	DrawingKind,
} from "../../shared/drawing.ts";

/** What the tutor describes: what's in the drawing and how it connects, never where things go. */
export interface DrawingDescription {
	id: string;
	kind: DrawingKind;
	title: string;
	nodes: { id: string; label: string }[];
	edges: { from: string; to: string; label?: string }[];
	groups: { id: string; label: string; nodes: string[] }[];
}

/** The tutor reads this message and can fix its description. */
export class DrawingError extends Error {}

const MAX_NODES = 40;
const CHAR_WIDTH = 9;
const LINE_HEIGHT = 20;
const BOX_PADDING = 40;
const MIN_WIDTH = 120;
const MAX_WIDTH = 220;

/** Box sizes are estimated from the label, since the harness can't measure the drawing font. */
function boxSize(label: string): { width: number; height: number } {
	const textWidth = label.length * CHAR_WIDTH;
	const width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, textWidth + BOX_PADDING));
	const lines = Math.max(1, Math.ceil(textWidth / (width - BOX_PADDING)));
	return { width, height: Math.max(60, lines * LINE_HEIGHT + 30) };
}

function check({ nodes, edges, groups }: DrawingDescription): void {
	if (nodes.length > MAX_NODES)
		throw new DrawingError(`Use at most ${MAX_NODES} nodes, so the drawing stays readable.`);
	const ids = new Set<string>();
	for (const node of nodes) {
		if (ids.has(node.id)) throw new DrawingError(`Two nodes have the id "${node.id}".`);
		ids.add(node.id);
	}
	for (const edge of edges)
		for (const end of [edge.from, edge.to])
			if (!ids.has(end)) throw new DrawingError(`An edge names "${end}", which isn't a node.`);
	const grouped = new Set<string>();
	for (const group of groups) {
		if (ids.has(group.id)) throw new DrawingError(`The group id "${group.id}" is also a node id.`);
		for (const id of group.nodes) {
			if (!ids.has(id))
				throw new DrawingError(`Group "${group.id}" names "${id}", which isn't a node.`);
			if (grouped.has(id)) throw new DrawingError(`"${id}" is in more than one group.`);
			grouped.add(id);
		}
	}
}

/** A plan grows upward, from foundations at the bottom to the goal at the top. */
const LAYOUT_OPTIONS = (kind: DrawingKind) => ({
	"elk.algorithm": "layered",
	"elk.direction": kind === "plan" ? "UP" : "DOWN",
	"elk.hierarchyHandling": "INCLUDE_CHILDREN",
	"elk.edgeRouting": "ORTHOGONAL",
	"elk.spacing.nodeNode": "40",
	"elk.layered.spacing.nodeNodeBetweenLayers": "60",
	"elk.padding": "[top=20,left=20,bottom=20,right=20]",
});

function graphOf(description: DrawingDescription): ElkNode {
	const leaf = (id: string, label: string): ElkNode => ({ id, ...boxSize(label) });
	const label = new Map(description.nodes.map((node) => [node.id, node.label]));
	const grouped = new Set(description.groups.flatMap((group) => group.nodes));
	return {
		id: "root",
		layoutOptions: LAYOUT_OPTIONS(description.kind),
		children: [
			...description.nodes
				.filter((node) => !grouped.has(node.id))
				.map((node) => leaf(node.id, node.label)),
			...description.groups.map((group) => ({
				id: group.id,
				layoutOptions: { "elk.padding": "[top=44,left=20,bottom=20,right=20]" },
				children: group.nodes.map((id) => leaf(id, label.get(id)!)),
			})),
		],
		edges: description.edges.map((edge, index) => ({
			id: `e${index}`,
			sources: [edge.from],
			targets: [edge.to],
		})),
	};
}

/** ELK places children relative to their parent, so every position is made absolute here. */
function placed(graph: ElkNode) {
	const origin = new Map<string, [number, number]>([["root", [0, 0]]]);
	const boxes = new Map<string, DrawingBox>();
	const groups: DrawingGroup[] = [];
	const visit = (node: ElkNode, [ox, oy]: [number, number]) => {
		for (const child of node.children ?? []) {
			const x = Math.round(ox + (child.x ?? 0));
			const y = Math.round(oy + (child.y ?? 0));
			origin.set(child.id, [x, y]);
			const box = {
				id: child.id,
				label: "",
				x,
				y,
				width: child.width ?? 0,
				height: child.height ?? 0,
			};
			if (child.children) {
				groups.push(box);
				visit(child, [x, y]);
			} else boxes.set(child.id, box);
		}
	};
	visit(graph, [0, 0]);
	return { origin, boxes, groups };
}

function arrowPoints(
	edge: ElkExtendedEdge,
	origin: Map<string, [number, number]>,
): [number, number][] {
	const [ox, oy] = origin.get((edge as { container?: string }).container ?? "root") ?? [0, 0];
	const section = edge.sections?.[0];
	if (!section) return [];
	const points = [section.startPoint, ...(section.bendPoints ?? []), section.endPoint];
	return points.map(({ x, y }) => [Math.round(ox + x), Math.round(oy + y)]);
}

/** Check a description and place everything in it. The same description always gives the same layout. */
export async function layOut(description: DrawingDescription): Promise<Drawing> {
	check(description);
	const graph = await new ELK().layout(graphOf(description));
	const { origin, boxes, groups } = placed(graph);
	const labels = new Map(
		[...description.nodes, ...description.groups].map((item) => [item.id, item.label]),
	);
	for (const item of [...boxes.values(), ...groups]) item.label = labels.get(item.id) ?? "";
	const arrows: DrawingArrow[] = description.edges.map((edge, index) => ({
		from: edge.from,
		to: edge.to,
		...(edge.label ? { label: edge.label } : {}),
		points: arrowPoints(graph.edges![index]!, origin),
	}));
	return {
		id: description.id,
		kind: description.kind,
		title: description.title,
		width: Math.round(graph.width ?? 0),
		height: Math.round(graph.height ?? 0),
		boxes: description.nodes.map((node) => boxes.get(node.id)!),
		arrows,
		groups,
	};
}
