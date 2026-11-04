import { useRef, useState, type DragEvent } from "react";

const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer.types).includes("Files");

/** Lets files be dropped anywhere in the element these handlers are attached to. */
export function useFileDrop(addFiles: (files: File[]) => void) {
	const [dragging, setDragging] = useState(false);
	const depth = useRef(0);

	const dropHandlers = {
		onDragEnter(event: DragEvent) {
			if (!hasFiles(event)) return;
			event.preventDefault();
			depth.current += 1;
			setDragging(true);
		},
		onDragOver(event: DragEvent) {
			if (hasFiles(event)) event.preventDefault();
		},
		onDragLeave(event: DragEvent) {
			if (!hasFiles(event)) return;
			depth.current -= 1;
			if (depth.current <= 0) setDragging(false);
		},
		onDrop(event: DragEvent) {
			if (!hasFiles(event)) return;
			event.preventDefault();
			depth.current = 0;
			setDragging(false);
			addFiles(Array.from(event.dataTransfer.files));
		},
	};

	return { dragging, dropHandlers };
}
