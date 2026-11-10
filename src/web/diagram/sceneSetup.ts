import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { useRef, useState, useSyncExternalStore } from "react";
import type { SceneElement } from "../../shared/drawing.ts";
import { FONT_NAME } from "./toExcalidraw.ts";

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

/** What the learner made: the scene, and a picture of it when it has freehand marks. */
export interface FinishedEdit {
	elements: SceneElement[];
	picture?: Blob;
}

/** What an editing canvas hands back once it's set up. */
export interface CanvasHandle {
	/** The finished edit, with its picture. */
	finish: () => Promise<FinishedEdit>;
	/** A copy of the scene as it is now, to carry the edit somewhere else. */
	elements: () => SceneElement[];
}

/** Done for an editing canvas: it waits for the picture, and does nothing before the canvas is ready. */
export function useCanvasDone(onDone: (edit: FinishedEdit) => void) {
	const handle = useRef<CanvasHandle>(undefined);
	const [saving, setSaving] = useState(false);
	const done = async () => {
		if (!handle.current) return;
		setSaving(true);
		try {
			onDone(await handle.current.finish());
		} finally {
			setSaving(false);
		}
	};
	const onReady = (next: CanvasHandle) => {
		handle.current = next;
	};
	return { handle, saving, done, onReady };
}

/** What a canvas shows: elements made on demand, and the area they cover. */
export interface SceneSource {
	make: () => ExcalidrawElement[];
	bounds: { x: number; y: number; width: number; height: number };
}

/** The area a saved scene covers. Arrows and lines measure from their first point. */
export function boundsOf(elements: readonly SceneElement[]): SceneSource["bounds"] {
	const live = elements.filter((element) => !element.isDeleted);
	if (live.length === 0) return { x: 0, y: 0, width: 1, height: 1 };
	const left = Math.min(...live.map((element) => element.x));
	const top = Math.min(...live.map((element) => element.y));
	const right = Math.max(...live.map((element) => element.x + Math.abs(element.width)));
	const bottom = Math.max(...live.map((element) => element.y + Math.abs(element.height)));
	return { x: left, y: top, width: right - left, height: bottom - top };
}

const DARK = "(prefers-color-scheme: dark)";
function subscribe(onChange: () => void) {
	const query = matchMedia(DARK);
	query.addEventListener("change", onChange);
	return () => query.removeEventListener("change", onChange);
}
const isDark = () => matchMedia(DARK).matches && document.documentElement.dataset.theme !== "light";

/** Excalidraw's theme, following the app's. */
export const useExcalidrawTheme = () =>
	useSyncExternalStore(subscribe, isDark) ? ("dark" as const) : ("light" as const);

/** Only drawing tools: no saving, loading, exporting or theme switching. */
export const UI_OPTIONS = {
	canvasActions: {
		changeViewBackgroundColor: false,
		clearCanvas: false,
		export: false,
		loadScene: false,
		saveAsImage: false,
		saveToActiveFile: false,
		toggleTheme: false,
	},
	tools: { image: false },
} as const;

const FONT_WAIT_MS = 2000;

/**
 * Excalidraw adds its font to the page while it sets up, just after mounting, and sizes each label
 * when its element is made. So a canvas mounts empty and gets its elements once the font has
 * loaded. Sized with a fallback font, labels are cut off.
 */
async function fontLoaded(): Promise<void> {
	const started = Date.now();
	while (![...document.fonts].some((face) => face.family === FONT_NAME)) {
		if (Date.now() - started > FONT_WAIT_MS) return;
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
	await document.fonts.load(`16px ${FONT_NAME}`).catch(() => undefined);
}

/**
 * Wait until a new canvas can take its elements: its font has loaded, and it has finished setting
 * up. Elements added before that can lose an arrow's label to another arrow.
 */
export async function sceneReady(api: ExcalidrawImperativeAPI): Promise<void> {
	await fontLoaded();
	const started = Date.now();
	while (api.getAppState().isLoading && Date.now() - started < FONT_WAIT_MS)
		await new Promise((resolve) => setTimeout(resolve, 20));
	await new Promise((resolve) => setTimeout(resolve, 0));
}
