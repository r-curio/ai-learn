import { Check, ChevronDown, ChevronUp, X } from "lucide-react";
import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import type { TranscriptBlock, TranscriptMessage } from "../../shared/protocol.ts";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../components/collapsible.tsx";

const FILLER_WORDS = [
	"Untangling…",
	"Pondering…",
	"Connecting the dots…",
	"Turning it over…",
	"Sketching it out…",
	"Checking the facts…",
	"Finding a good example…",
	"Gathering thoughts…",
];
const FILLER_SECONDS = 3;

type TraceBlock = Exclude<TranscriptBlock, { kind: "text" }>;
type ToolBlock = Extract<TranscriptBlock, { kind: "tool" }>;

const traceOf = (message: TranscriptMessage) =>
	message.blocks.filter((block): block is TraceBlock => block.kind !== "text");

/** A plain reply saved before this block existed has nothing to report, so it shows nothing. */
export const hasActivity = (message: TranscriptMessage, liveSince?: number) =>
	liveSince !== undefined || message.workedMs !== undefined || traceOf(message).length > 0;

function formatSeconds(seconds: number): string {
	if (seconds < 60) return `${seconds}s`;
	return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function formatToolDuration(ms: number): string {
	return ms < 10_000 ? `${(ms / 1000).toFixed(1)}s` : formatSeconds(Math.round(ms / 1000));
}

/** Whole seconds since a run started, ticking while it's in progress. */
function useElapsedSeconds(since: number | undefined): number {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (since === undefined) return;
		const timer = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(timer);
	}, [since]);
	return since === undefined ? 0 : Math.max(0, Math.floor((now - since) / 1000));
}

function Spinner() {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 14 14"
			className="shrink-0 motion-safe:animate-spin"
			aria-hidden="true"
		>
			<circle cx="7" cy="7" r="5.5" fill="none" strokeWidth="1.8" className="stroke-border" />
			<circle
				cx="7"
				cy="7"
				r="5.5"
				fill="none"
				strokeWidth="1.8"
				strokeLinecap="round"
				strokeDasharray="8.64 34.56"
				transform="rotate(-90 7 7)"
				className="stroke-primary"
			/>
		</svg>
	);
}

function ToolStep({ block, live }: { block: ToolBlock; live: boolean }) {
	const running = block.state === "running" && live;
	const failed = block.state === "failed" || (block.state === "running" && !live);
	const Icon = failed ? X : Check;
	return (
		<div className="flex min-h-5 items-center gap-2">
			<span className="flex size-3.5 shrink-0 items-center justify-center">
				{running ? (
					<Spinner />
				) : (
					<Icon
						className={`size-3.5 ${failed ? "text-destructive" : "text-muted-foreground"}`}
						strokeWidth={1.5}
						aria-hidden="true"
					/>
				)}
			</span>
			<span
				className={`min-w-0 grow text-[13px] leading-5 ${failed ? "text-destructive" : "text-foreground"}`}
			>
				{running ? `${block.runningLabel ?? block.label}…` : block.label}
				{failed && " failed"}
			</span>
			{block.durationMs !== undefined && !running && (
				<span className="shrink-0 text-xs leading-4 text-muted-foreground">
					{formatToolDuration(block.durationMs)}
				</span>
			)}
		</div>
	);
}

function Trace({ blocks, live }: { blocks: TraceBlock[]; live: boolean }) {
	return (
		<div className="flex flex-col gap-2.5 border-l border-border pl-4 wrap-anywhere">
			{blocks.map((block, index) =>
				block.kind === "tool" ? (
					<ToolStep block={block} live={live} key={block.id} />
				) : (
					<div
						className="flex flex-col gap-2 text-sm leading-[21px] text-muted-foreground"
						key={index}
					>
						{/* Summaries can carry light Markdown, but nothing here should look like a reply. */}
						<Markdown allowedElements={["p", "strong", "em", "code"]} unwrapDisallowed>
							{block.text}
						</Markdown>
					</div>
				),
			)}
		</div>
	);
}

/** The header's words. Seconds and rotating filler are hidden from screen readers, which would read every change. */
function Status({ message, liveSince, working }: Props & { working: boolean }) {
	const elapsed = useElapsedSeconds(working ? liveSince : undefined);
	const trace = traceOf(message);
	const tools = trace.filter((block) => block.kind === "tool").length;
	if (working) {
		const filler = FILLER_WORDS[Math.floor(elapsed / FILLER_SECONDS) % FILLER_WORDS.length]!;
		const word = tools > 0 ? "Working" : trace.length > 0 ? "Thinking" : undefined;
		return (
			<>
				<span className="text-sm leading-5 font-medium text-foreground">
					{word ?? (
						<>
							<span aria-hidden="true">{filler}</span>
							<span className="sr-only">Working</span>
						</>
					)}
				</span>
				<span className="text-[13px] leading-4 text-muted-foreground" aria-hidden="true">
					{formatSeconds(elapsed)}
				</span>
			</>
		);
	}
	const seconds = message.workedMs === undefined ? undefined : Math.round(message.workedMs / 1000);
	return (
		<>
			<span className="text-sm leading-5 font-medium text-foreground">
				{seconds === undefined ? "Worked" : `Worked for ${formatSeconds(Math.max(seconds, 1))}`}
			</span>
			{tools > 0 && (
				<span className="text-[13px] leading-4 text-muted-foreground">
					{tools} {tools === 1 ? "tool" : "tools"}
				</span>
			)}
		</>
	);
}

interface Props {
	message: TranscriptMessage;
	liveSince?: number;
}

/** What the tutor is doing, or did, before the reply. It's open during the work and closes when the reply starts. */
export function ActivityBlock({ message, liveSince }: Props) {
	const live = liveSince !== undefined;
	const trace = traceOf(message);
	const working = live && message.workedMs === undefined;
	const [chosen, setChosen] = useState<boolean>();
	const open = trace.length > 0 && (chosen ?? working);
	const Chevron = open ? ChevronUp : ChevronDown;
	const icon = working ? (
		<Spinner />
	) : (
		<Check
			className="size-3.5 shrink-0 text-muted-foreground"
			strokeWidth={1.5}
			aria-hidden="true"
		/>
	);
	const status = <Status message={message} liveSince={liveSince} working={working} />;

	if (trace.length === 0) {
		return (
			<div className="flex h-7 items-center gap-2">
				{icon}
				{status}
			</div>
		);
	}
	return (
		<Collapsible open={open} onOpenChange={setChosen}>
			<CollapsibleTrigger className="flex h-7 items-center gap-2 rounded-sm outline-ring focus-visible:outline-2 focus-visible:outline-offset-2">
				{icon}
				{status}
				<Chevron
					className="size-3 shrink-0 text-muted-foreground"
					strokeWidth={1.5}
					aria-hidden="true"
				/>
			</CollapsibleTrigger>
			<CollapsibleContent>
				<div className="pt-1.5">
					<Trace blocks={trace} live={live} />
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}
