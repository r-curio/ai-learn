import { ArrowUp, Plus } from "lucide-react";
import { useRef, type RefObject } from "react";
import type { ContextUsage, ProviderOption } from "../../shared/protocol.ts";
import { Button } from "../components/button.tsx";
import { IconButton } from "../components/IconButton.tsx";
import type { VoiceRecorder } from "../voice/useVoiceRecorder.ts";
import { VoiceControl } from "../voice/VoiceControl.tsx";
import { ContextMeter } from "./ContextMeter.tsx";
import { EffortMenu } from "./EffortMenu.tsx";
import { ModelPicker } from "./ModelPicker.tsx";
import type { ModelChoice } from "./useModelChoice.ts";

interface ComposerControlsProps {
	canAttach: boolean;
	canSend: boolean;
	running: boolean;
	providers: ProviderOption[];
	modelChoice: ModelChoice;
	context?: ContextUsage;
	/** The composer's card, which the context details float above. */
	card: RefObject<HTMLDivElement | null>;
	onNewChat: () => void;
	/** The app can't reply yet, so there's nothing to choose for. */
	menusDisabled: boolean;
	onAddProvider: () => void;
	onAddFiles: (files: File[]) => void;
	onStop: () => void;
	voice: VoiceRecorder;
	/** Words can't go into the box yet. */
	voiceDisabled: boolean;
}

function AttachButton({
	canAttach,
	onAddFiles,
}: Pick<ComposerControlsProps, "canAttach" | "onAddFiles">) {
	const fileInput = useRef<HTMLInputElement>(null);
	return (
		<>
			<IconButton
				aria-label="Attach files"
				// The plus sits centred in its hover shape, and the margin keeps it lined up with the text.
				className="-ml-[5px] size-8 p-0"
				disabled={!canAttach}
				onClick={() => fileInput.current?.click()}
			>
				<Plus className="size-5" strokeWidth={1.5} />
			</IconButton>
			<input
				ref={fileInput}
				type="file"
				multiple
				hidden
				onChange={(event) => {
					onAddFiles(Array.from(event.target.files ?? []));
					event.target.value = "";
				}}
			/>
		</>
	);
}

/** The row under the message box: Attach and context on the left, then the menus, the mic, and Send or Stop on the right. */
export function ComposerControls(props: ComposerControlsProps) {
	const { canAttach, canSend, running, providers, modelChoice, menusDisabled } = props;
	const { context, card, onNewChat, onAddProvider, onAddFiles, onStop, voice, voiceDisabled } =
		props;
	const row = useRef<HTMLDivElement>(null);

	return (
		<div ref={row} className="mt-[22px] flex items-center justify-between">
			<div className="flex flex-none items-center">
				<AttachButton canAttach={canAttach} onAddFiles={onAddFiles} />
				<ContextMeter
					context={context}
					// The next call runs on the composer's model, so that's the limit that matters.
					limit={modelChoice.model?.contextWindow ?? context?.limit}
					card={card}
					disabled={menusDisabled}
					running={running}
					onNewChat={onNewChat}
				/>
			</div>
			<div className="flex min-w-0 items-center gap-1">
				<ModelPicker
					providers={providers}
					choice={modelChoice}
					anchor={row}
					disabled={menusDisabled}
					onAddProvider={onAddProvider}
				/>
				<EffortMenu choice={modelChoice} anchor={row} disabled={menusDisabled} />
				<VoiceControl voice={voice} disabled={voiceDisabled} />
				{running ? (
					<Button
						size="icon"
						aria-label="Stop reply"
						className="size-8 rounded-full p-0"
						onClick={onStop}
					>
						<span className="size-2.5 rounded-[2px] bg-primary-foreground" />
					</Button>
				) : (
					<Button
						size="icon"
						type="submit"
						aria-label="Send message"
						className="size-8 rounded-full p-0"
						disabled={!canSend}
					>
						<ArrowUp className="size-[18px]" strokeWidth={1.8} />
					</Button>
				)}
			</div>
		</div>
	);
}
