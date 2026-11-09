import "@excalidraw/excalidraw/index.css";
import { Excalidraw, exportToBlob as untypedExportToBlob } from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { SceneElement } from "../../shared/drawing.ts";
import { fontLoaded, UI_OPTIONS, useExcalidrawTheme } from "./sceneSetup.ts";

/** What the learner made: the scene, and a picture of it when it has freehand marks. */
export interface FinishedEdit {
	elements: SceneElement[];
	picture?: Blob;
}

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

async function finish(api: ExcalidrawImperativeAPI): Promise<FinishedEdit> {
	const live = api.getSceneElements();
	const elements = structuredClone(live) as unknown as SceneElement[];
	if (!live.some((element) => element.type === "freedraw")) return { elements };
	const picture = await exportToBlob({
		elements: live,
		appState: { exportBackground: true, viewBackgroundColor: pageColour() },
		files: null,
		mimeType: "image/png",
	});
	return { elements, picture };
}

/** The full editor. Excalidraw is large, so this loads only when the learner opens it. */
export default function EditorCanvas(props: {
	initial: () => ExcalidrawElement[];
	onReady: (finish: () => Promise<FinishedEdit>) => void;
}) {
	const theme = useExcalidrawTheme();
	return (
		<Excalidraw
			initialData={{ appState: { viewBackgroundColor: "transparent" } }}
			excalidrawAPI={(api) => {
				props.onReady(() => finish(api));
				void fontLoaded().then(() => {
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
