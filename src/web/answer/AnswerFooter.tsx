import { useRef } from "react";
import type { ContextUsage, ProviderOption } from "../../shared/protocol.ts";
import { ContextMeter } from "../composer/ContextMeter.tsx";
import { EffortMenu } from "../composer/EffortMenu.tsx";
import { ModelPicker } from "../composer/ModelPicker.tsx";
import type { ModelChoice } from "../composer/useModelChoice.ts";

/** The composer's meter and menus, which move below the card while a question waits. */
export function AnswerFooter({
	providers,
	modelChoice,
	context,
	disabled,
	onNewChat,
	onAddProvider,
}: {
	providers: ProviderOption[];
	modelChoice: ModelChoice;
	context?: ContextUsage;
	disabled: boolean;
	onNewChat: () => void;
	onAddProvider: () => void;
}) {
	const row = useRef<HTMLDivElement>(null);
	return (
		<div
			ref={row}
			className="@container flex flex-none items-center justify-between pt-2 pr-1.5 pl-[3px]"
		>
			<ContextMeter
				context={context}
				limit={modelChoice.model?.contextWindow ?? context?.limit}
				// The card is too tall to float the details above, so they sit just over this row, like the menus.
				card={row}
				disabled={disabled}
				running={false}
				onNewChat={onNewChat}
			/>
			<div className="flex min-w-0 items-center gap-1">
				<ModelPicker
					providers={providers}
					choice={modelChoice}
					anchor={row}
					disabled={disabled}
					onAddProvider={onAddProvider}
				/>
				<EffortMenu choice={modelChoice} anchor={row} disabled={disabled} />
			</div>
		</div>
	);
}
