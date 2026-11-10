import "@excalidraw/excalidraw/index.css";
import { Excalidraw } from "@excalidraw/excalidraw";
import type { AppState, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Drawing } from "../../shared/drawing.ts";
import styles from "./scene.module.css";
import { FONT_NAME, toExcalidraw } from "./toExcalidraw.ts";

const DARK = "(prefers-color-scheme: dark)";
function subscribe(onChange: () => void) {
	const query = matchMedia(DARK);
	query.addEventListener("change", onChange);
	return () => query.removeEventListener("change", onChange);
}
const isDark = () => matchMedia(DARK).matches && document.documentElement.dataset.theme !== "light";

const UI_OPTIONS = {
	canvasActions: {
		changeViewBackgroundColor: false,
		clearCanvas: false,
		export: false,
		loadScene: false,
		saveAsImage: false,
		saveToActiveFile: false,
		toggleTheme: false,
	},
} as const;

const MARGIN = 24;

/** The whole drawing, centred, shrunk to fit the frame but never enlarged past its saved size. */
function viewFor(drawing: Drawing, frame: DOMRect) {
	const zoom = Math.max(
		0.1,
		Math.min(1, (frame.width - MARGIN) / drawing.width, (frame.height - MARGIN) / drawing.height),
	);
	return {
		zoom: { value: zoom } as AppState["zoom"],
		scrollX: (frame.width / zoom - drawing.width) / 2,
		scrollY: (frame.height / zoom - drawing.height) / 2,
	};
}

/** The view is set before the first paint, and again whenever the card changes size. */
function useFittedView(drawing: Drawing) {
	const frame = useRef<HTMLDivElement>(null);
	const [view, setView] = useState<ReturnType<typeof viewFor>>();
	const api = useRef<ExcalidrawImperativeAPI>(undefined);
	useEffect(() => {
		const element = frame.current;
		if (!element) return;
		const observer = new ResizeObserver(() => {
			const next = viewFor(drawing, element.getBoundingClientRect());
			setView((current) => current ?? next);
			api.current?.updateScene({ appState: next });
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, [drawing]);
	return { frame, view, setApi: (value: ExcalidrawImperativeAPI) => (api.current = value) };
}

const FONT_WAIT_MS = 2000;

/** Excalidraw adds its font to the page while it sets up its scene, just after mounting. */
async function fontAdded(): Promise<void> {
	const started = Date.now();
	while (![...document.fonts].some((face) => face.family === FONT_NAME)) {
		if (Date.now() - started > FONT_WAIT_MS) return;
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
	await document.fonts.load(`16px ${FONT_NAME}`).catch(() => undefined);
}

/**
 * Excalidraw sizes each label when its element is made and keeps that size, so the canvas mounts
 * empty and the drawing is added once the font has loaded. Sized with a fallback font, labels are cut off.
 */
async function addOnceFontLoads(api: ExcalidrawImperativeAPI, drawing: Drawing) {
	await fontAdded();
	api.updateScene({ elements: toExcalidraw(drawing) });
}

/** Excalidraw is large, so this file loads only when a chat has a drawing. It's view-only for now. */
export default function DrawingScene({ drawing }: { drawing: Drawing }) {
	const dark = useSyncExternalStore(subscribe, isDark);
	const { frame, view, setApi } = useFittedView(drawing);
	return (
		<div ref={frame} className={styles.scene}>
			{view && (
				<Excalidraw
					initialData={{ appState: { viewBackgroundColor: "transparent", ...view } }}
					excalidrawAPI={(api) => {
						setApi(api);
						void addOnceFontLoads(api, drawing);
					}}
					viewModeEnabled
					zenModeEnabled
					theme={dark ? "dark" : "light"}
					UIOptions={UI_OPTIONS}
					detectScroll={false}
					handleKeyboardGlobally={false}
				/>
			)}
		</div>
	);
}
