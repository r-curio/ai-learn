import { Check, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import type { VoiceModels } from "../../shared/protocol.ts";
import { getVoiceModels } from "../api.ts";
import { Button } from "../components/button.tsx";
import { Command, CommandGroup, CommandItem, CommandList } from "../components/command.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "../components/popover.tsx";

const TRIGGER = "h-8 max-w-[240px] gap-1.5 rounded-md px-[7px] text-[13px] leading-4";

interface VoiceModelMenuProps {
	engineId: string;
	engineLabel: string;
	/** The saved model. Missing means the engine's default. */
	current?: string;
	onChoose: (model: string) => void;
}

/** Which of the engine's models to use. The list comes from the provider, so it's never out of date. */
export function VoiceModelMenu({ engineId, engineLabel, current, onChoose }: VoiceModelMenuProps) {
	const [list, setList] = useState<VoiceModels>();
	const [error, setError] = useState<string>();
	const [open, setOpen] = useState(false);
	// Each engine's row has its own menu, so the engine never changes under one.
	useEffect(() => {
		getVoiceModels(engineId)
			.then(setList)
			.catch((cause: Error) => setError(cause.message));
	}, [engineId]);

	if (error)
		return (
			<span role="alert" className="max-w-[260px] truncate text-[12px] leading-4 text-destructive">
				{error}
			</span>
		);
	const shown = current ?? list?.defaultModel;
	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					disabled={!list}
					aria-label={`${engineLabel} model: ${shown ?? "loading"}`}
					className={`${TRIGGER} font-medium text-foreground`}
				>
					<span className="truncate">{shown ?? "Loading models"}</span>
					<ChevronDown className="size-3 text-muted-foreground" strokeWidth={2.8} />
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" sideOffset={6} className="w-[280px] overflow-hidden">
				<Command>
					<CommandList>
						<CommandGroup heading={`${engineLabel} models`}>
							{list?.models.map((model) => (
								<CommandItem
									key={model}
									value={model}
									onSelect={() => {
										onChoose(model);
										setOpen(false);
									}}
								>
									<span className="flex-1 truncate">{model}</span>
									{model === list.defaultModel && (
										<span className="text-[12px] leading-4 text-muted-foreground">Default</span>
									)}
									<Check
										className={`size-4 text-primary ${model === shown ? "" : "invisible"}`}
										strokeWidth={2}
									/>
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
