import "@excalidraw/excalidraw/index.css";
import { Excalidraw, exportToBlob as untypedExportToBlob } from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { SceneElement } from "../../shared/drawing.ts";
import {
	sceneReady,
	UI_OPTIONS,
	useExcalidrawTheme,
	type CanvasHandle,
	type FinishedEdit,
} from "./sceneSetup.ts";

/** Excalidraw's export types don't resolve from its package, so the part used here is written out. */
const exportToBlob = untypedExportToBlob as unknown as (options: {
	elements: readonly ExcalidrawElement[];
	appState: { exportBackground: boolean; viewBackgroundColor: string };
	files: null;
	mimeType: string;
}) => Promise<Blob>;

/** The picture goes to the model, so it gets the light page colour whatever the theme. */
const pageColour = () =>
	getComputedStyle(document.documentElement).getPropertyValue("--diagram-page").trim();

/** Excalidraw changes elements in place, so what leaves the canvas is a copy. */
const copyOf = (api: ExcalidrawImperativeAPI) =>
	structuredClone(api.getSceneElements()) as unknown as SceneElement[];

async function finish(api: ExcalidrawImperativeAPI): Promise<FinishedEdit> {
	const live = api.getSceneElements();
	const elements = copyOf(api);
	if (!live.some((element) => element.type === "freedraw")) return { elements };
	const picture = await exportToBlob({
		elements: live,
		appState: { exportBackground: true, viewBackgroundColor: pageColour() },
		files: null,
		mimeType: "image/png",
	});
	return { elements, picture };
}

/** An editing canvas, in a card or the full-size editor. Excalidraw is large, so this loads only when the learner edits. */
export default function EditorCanvas(props: {
	initial: () => ExcalidrawElement[];
	onReady: (handle: CanvasHandle) => void;
}) {
	const theme = useExcalidrawTheme();
	return (
		<Excalidraw
			initialData={{ appState: { viewBackgroundColor: "transparent" } }}
			excalidrawAPI={(api) => {
				props.onReady({ finish: () => finish(api), elements: () => copyOf(api) });
				void sceneReady(api).then(() => {
					api.updateScene({ elements: props.initial() });
					api.scrollToContent(undefined, { fitToViewport: true, viewportZoomFactor: 0.7 });
				});
			}}
			theme={theme}
			UIOptions={UI_OPTIONS}
			handleKeyboardGlobally={false}
		/>
	);
}
