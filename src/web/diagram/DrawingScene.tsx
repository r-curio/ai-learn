import "@excalidraw/excalidraw/index.css";
import { Excalidraw } from "@excalidraw/excalidraw";
import type { AppState, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { useEffect, useRef, useState } from "react";
import styles from "./scene.module.css";
import { sceneReady, UI_OPTIONS, useExcalidrawTheme, type SceneSource } from "./sceneSetup.ts";

const MARGIN = 24;

/** The whole scene, centred, shrunk to fit the frame but never enlarged past its saved size. */
function viewFor({ x, y, width, height }: SceneSource["bounds"], frame: DOMRect) {
	const zoom = Math.max(
		0.1,
		Math.min(1, (frame.width - MARGIN) / width, (frame.height - MARGIN) / height),
	);
	return {
		zoom: { value: zoom } as AppState["zoom"],
		scrollX: frame.width / zoom / 2 - (x + width / 2),
		scrollY: frame.height / zoom / 2 - (y + height / 2),
	};
}

/** The view is set before the first paint, and again whenever the card changes size. */
function useFittedView(bounds: SceneSource["bounds"]) {
	const frame = useRef<HTMLDivElement>(null);
	const [view, setView] = useState<ReturnType<typeof viewFor>>();
	const api = useRef<ExcalidrawImperativeAPI>(undefined);
	useEffect(() => {
		const element = frame.current;
		if (!element) return;
		const observer = new ResizeObserver(() => {
			const next = viewFor(bounds, element.getBoundingClientRect());
			setView((current) => current ?? next);
			api.current?.updateScene({ appState: next });
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, [bounds]);
	return { frame, view, setApi: (value: ExcalidrawImperativeAPI) => (api.current = value) };
}

/** A view-only canvas. Excalidraw is large, so this file loads only when a chat has a drawing. */
export default function DrawingScene({ source }: { source: SceneSource }) {
	const theme = useExcalidrawTheme();
	const { frame, view, setApi } = useFittedView(source.bounds);
	return (
		<div ref={frame} className={styles.scene}>
			{view && (
				<Excalidraw
					initialData={{ appState: { viewBackgroundColor: "transparent", ...view } }}
					excalidrawAPI={(api) => {
						setApi(api);
						void sceneReady(api).then(() => api.updateScene({ elements: source.make() }));
					}}
					viewModeEnabled
					zenModeEnabled
					theme={theme}
					UIOptions={UI_OPTIONS}
					detectScroll={false}
					handleKeyboardGlobally={false}
				/>
			)}
		</div>
	);
}
