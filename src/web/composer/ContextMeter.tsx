import { cn } from "cn";
import {
	useMemo,
	useRef,
	useState,
	type MouseEvent,
	type PointerEvent,
	type RefObject,
} from "react";
import type { ContextUsage } from "../../shared/protocol.ts";
import { Button } from "../components/button.tsx";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "../components/popover.tsx";

/** The ring's circumference, rounded the way the frames draw it. */
const RING_LENGTH = 44;
/** Long enough to cross the gap between the meter and its details. */
const CLOSE_DELAY_MS = 200;

const LEVELS = {
	normal: {
		ring: "stroke-primary",
		label: "text-muted-foreground",
		message: "The tutor still has plenty of room in this chat.",
	},
	filling: {
		ring: "stroke-warning",
		label: "text-warning",
		message: "Getting full. Start a new chat soon.",
	},
	full: {
		ring: "stroke-destructive",
		label: "text-destructive",
		message: "Almost full. Start a new chat to keep going.",
	},
};

function levelOf(percent: number): keyof typeof LEVELS {
	if (percent >= 95) return "full";
	return percent >= 80 ? "filling" : "normal";
}

function Ring({ percent, className }: { percent: number; className: string }) {
	const filled = (Math.min(percent, 100) / 100) * RING_LENGTH;
	return (
		<svg className="size-[18px]" viewBox="0 0 18 18" aria-hidden="true">
			<circle cx="9" cy="9" r="7" fill="none" strokeWidth="2" className="stroke-border" />
			<circle
				cx="9"
				cy="9"
				r="7"
				fill="none"
				strokeWidth="2"
				strokeDasharray={`${filled} ${RING_LENGTH}`}
				transform="rotate(-90 9 9)"
				className={cn(
					"transition-[stroke] duration-200 ease-fluid motion-safe:transition-[stroke,stroke-dasharray]",
					className,
				)}
			/>
		</svg>
	);
}

/**
 * Hovering opens the details without moving focus, so the learner can keep typing. The keyboard and
 * touch use the trigger like any other popover, which moves focus in and returns it on close.
 */
function useHoverPopover() {
	const [open, setOpen] = useState(false);
	const keepFocus = useRef(false);
	const closing = useRef<ReturnType<typeof setTimeout>>(undefined);

	const hoverProps = {
		onPointerEnter(event: PointerEvent) {
			if (event.pointerType !== "mouse") return;
			clearTimeout(closing.current);
			if (!open) keepFocus.current = true;
			setOpen(true);
		},
		onPointerLeave(event: PointerEvent) {
			if (event.pointerType !== "mouse" || !keepFocus.current) return;
			closing.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
		},
	};
	return {
		rootProps: { open, onOpenChange: setOpen },
		triggerProps: {
			...hoverProps,
			onClick(event: MouseEvent) {
				// Hover already showed the details, so a click shouldn't take them away.
				if (keepFocus.current) event.preventDefault();
			},
		},
		contentProps: {
			...hoverProps,
			onOpenAutoFocus(event: Event) {
				if (keepFocus.current) event.preventDefault();
			},
			// This runs once the details have finished leaving, so the next opening starts fresh.
			onCloseAutoFocus(event: Event) {
				if (keepFocus.current) event.preventDefault();
				keepFocus.current = false;
			},
		},
		/** Close without handing focus back to the meter, because something else is taking it. */
		dismiss: () => {
			keepFocus.current = true;
			setOpen(false);
		},
	};
}

/** Lines up with the meter, but sits on the card's top edge however tall the message has grown. */
function useAboveCardAnchor(
	meter: RefObject<HTMLButtonElement | null>,
	card: RefObject<HTMLDivElement | null>,
) {
	return useMemo(
		() => ({
			current: {
				getBoundingClientRect() {
					const rect = meter.current?.getBoundingClientRect() ?? new DOMRect();
					const top = card.current?.getBoundingClientRect().top ?? rect.top;
					return new DOMRect(rect.left, top, rect.width, 0);
				},
			},
		}),
		[meter, card],
	);
}

interface ContextMeterProps {
	context?: ContextUsage;
	limit?: number;
	card: RefObject<HTMLDivElement | null>;
	disabled: boolean;
	running: boolean;
	onNewChat: () => void;
}

/** How full the chat is, as a ring and a percentage, with the exact count in its details. */
export function ContextMeter(props: ContextMeterProps) {
	const { context, limit, card, disabled, running, onNewChat } = props;
	const { rootProps, triggerProps, contentProps, dismiss } = useHoverPopover();
	const meter = useRef<HTMLButtonElement>(null);
	const anchor = useAboveCardAnchor(meter, card);
	const tokens = context?.tokens ?? 0;
	const percent = limit ? Math.round((tokens / limit) * 100) : 0;
	const level = levelOf(percent);
	const { ring, label, message } = LEVELS[level];

	return (
		<Popover {...rootProps}>
			<PopoverAnchor virtualRef={anchor} />
			<PopoverTrigger asChild>
				<Button
					ref={meter}
					variant="ghost"
					size="sm"
					// With no model and no reply yet there's no limit, so there are no details to show.
					disabled={disabled || !limit}
					className="ml-[5px] h-8 gap-1.5 rounded-md px-1.5 text-[13px] leading-4 tabular-nums hover:bg-transparent disabled:opacity-100 aria-expanded:bg-transparent"
					{...triggerProps}
				>
					<Ring percent={percent} className={ring} />
					<span className={cn("transition-colors duration-150", label)}>
						{percent}%<span className="in-data-compact:sr-only @max-[480px]:sr-only"> context</span>
					</span>
				</Button>
			</PopoverTrigger>
			<PopoverContent
				side="top"
				align="start"
				sideOffset={6}
				alignOffset={-1}
				className="flex w-[270px] flex-col gap-1.5 px-3.5 py-3"
				{...contentProps}
			>
				<p className="text-[14px] leading-[18px] font-medium tabular-nums">
					{tokens.toLocaleString()} of {limit?.toLocaleString()} tokens
				</p>
				<p className="text-[13px] leading-[18px] text-muted-foreground">{message}</p>
				{level === "full" && (
					<Button
						variant="ghost"
						disabled={running}
						className="mt-0.5 justify-start self-start border-0 p-0 text-[13px] leading-[18px] font-medium text-primary hover:bg-transparent hover:text-primary hover:underline"
						onClick={() => {
							dismiss();
							onNewChat();
						}}
					>
						Start a new chat
					</Button>
				)}
			</PopoverContent>
		</Popover>
	);
}
