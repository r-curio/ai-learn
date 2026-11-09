import { useEffect, useRef } from "react";
import type { VoiceRecorder } from "./useVoiceRecorder.ts";

/** Holding space this long starts recording. Shorter is a tap, which types a space as usual. */
const HOLD_MS = 350;

/** Popovers, menus and dialogs keep space for themselves. */
const OPEN_LAYER = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';

type TextField = HTMLInputElement | HTMLTextAreaElement;

/** Inputs where space types a character. */
const TYPED = ["text", "search", "email", "url", "tel", "password", "number"];

function textField(element: Element | null): TextField | undefined {
	if (element instanceof HTMLTextAreaElement) return element;
	if (element instanceof HTMLInputElement && TYPED.includes(element.type)) return element;
	return undefined;
}

/** Take back the space the start of the hold typed, as long as it's still right before the cursor. */
function removeTypedSpace(field: TextField) {
	const end = field.selectionStart;
	if (end === null || end !== field.selectionEnd || field.value[end - 1] !== " ") return;
	field.setRangeText("", end - 1, end, "end");
	// React only hears about a change made this way through an input event.
	field.dispatchEvent(new Event("input", { bubbles: true }));
}

interface HoldOptions<Target extends string> {
	voice: VoiceRecorder;
	/** Words can't go anywhere yet, so space is just space. */
	enabled: boolean;
	/** Where words go when focus isn't in a text box. A text box names its own with `data-dictation`. */
	fallback: Target;
	/** Called as recording starts, with where the words should go. */
	onStart?: (target: Target) => void;
}

/**
 * Hold space to record, and let go to stop. A tap still types a space or presses the focused
 * button. Text boxes without `data-dictation` keep space as normal.
 */
export function useHoldToTalk<Target extends string>(options: HoldOptions<Target>) {
	const latest = useRef(options);
	useEffect(() => {
		latest.current = options;
	});

	useEffect(() => {
		let pending: ReturnType<typeof setTimeout> | undefined;
		let holding = false;

		const release = () => {
			clearTimeout(pending);
			pending = undefined;
			if (!holding) return;
			holding = false;
			const { voice } = latest.current;
			// Let go while the microphone was still opening, so there's nothing to keep.
			if (voice.phase === "recording") void voice.stop();
			else voice.cancel();
		};

		const targetFor = (focused: Element | null): Target | undefined => {
			const field = textField(focused);
			if (!field) return latest.current.fallback;
			return (field.dataset.dictation as Target | undefined) ?? undefined;
		};

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== " ") {
				// Another key before the hold starts means the learner is typing, not talking.
				if (pending) release();
				return;
			}
			if (pending || holding) {
				// Key repeat would type more spaces, or press a button again.
				event.preventDefault();
				return;
			}
			if (event.repeat || event.isComposing || event.ctrlKey || event.altKey || event.metaKey)
				return;
			if (!latest.current.enabled || document.querySelector(OPEN_LAYER)) return;
			const focused = document.activeElement;
			const target = targetFor(focused);
			if (target === undefined) return;
			pending = setTimeout(() => {
				pending = undefined;
				holding = true;
				const field = textField(focused);
				if (field) removeTypedSpace(field);
				latest.current.onStart?.(target);
				void latest.current.voice.start();
			}, HOLD_MS);
		};

		const onKeyUp = (event: KeyboardEvent) => {
			if (event.key !== " ") return;
			// A focused button would be pressed by this keyup, which isn't what a hold means.
			if (holding) event.preventDefault();
			release();
		};

		document.addEventListener("keydown", onKeyDown, true);
		document.addEventListener("keyup", onKeyUp, true);
		window.addEventListener("blur", release);
		return () => {
			document.removeEventListener("keydown", onKeyDown, true);
			document.removeEventListener("keyup", onKeyUp, true);
			window.removeEventListener("blur", release);
			release();
		};
	}, []);
}
