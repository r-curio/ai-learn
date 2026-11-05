import { ArrowUp, Plus } from "lucide-react";
import { useRef } from "react";
import { Button } from "../components/button.tsx";
import { IconButton } from "../components/IconButton.tsx";
import type { ProviderOption } from "../settings/useProviders.ts";
import { EffortMenu } from "./EffortMenu.tsx";
import { ModelPicker } from "./ModelPicker.tsx";
import type { ModelChoice } from "./useModelChoice.ts";

interface ComposerControlsProps {
	canAttach: boolean;
	canSend: boolean;
	running: boolean;
	providers: ProviderOption[];
	modelChoice: ModelChoice;
	/** The app can't reply yet, so there's nothing to choose for. */
	menusDisabled: boolean;
	onAddProvider: () => void;
	onAddFiles: (files: File[]) => void;
	onStop: () => void;
}

/** The row under the message box: Attach on the left, then the menus and Send or Stop on the right. */
export function ComposerControls(props: ComposerControlsProps) {
	const { canAttach, canSend, running, providers, modelChoice, menusDisabled } = props;
	const { onAddProvider, onAddFiles, onStop } = props;
	const fileInput = useRef<HTMLInputElement>(null);
	const row = useRef<HTMLDivElement>(null);

	return (
		<div ref={row} className="mt-[22px] flex items-center justify-between">
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
			<div className="flex items-center gap-1">
				<ModelPicker
					providers={providers}
					choice={modelChoice}
					anchor={row}
					disabled={menusDisabled}
					onAddProvider={onAddProvider}
				/>
				<EffortMenu choice={modelChoice} anchor={row} disabled={menusDisabled} />
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
