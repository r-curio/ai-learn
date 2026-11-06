import { Check, ChevronDown } from "lucide-react";
import { useState, type RefObject } from "react";
import type { ModelOption, ProviderOption } from "../../shared/protocol.ts";
import { Badge } from "../components/badge.tsx";
import { Button } from "../components/button.tsx";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "../components/command.tsx";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "../components/popover.tsx";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "../components/tooltip.tsx";
import type { ModelChoice } from "./useModelChoice.ts";

export const COMPOSER_MENU = { side: "top", align: "end", sideOffset: 6, alignOffset: -4 } as const;

export const MENU_TRIGGER = "h-8 gap-1.5 rounded-md px-[7px] text-[13px] leading-4";

const keyOf = ({ provider, id }: ModelOption) => `${provider}/${id}`;

function contextLabel(tokens: number) {
	return tokens >= 1_000_000
		? `${Math.round(tokens / 100_000) / 10}M`
		: `${Math.round(tokens / 1000)}K`;
}

function price(dollars: number) {
	return `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}`;
}

function priceLabel({ inputPrice, outputPrice }: ModelOption) {
	return `${price(inputPrice)} in · ${price(outputPrice)} out per 1M tokens`;
}

/** Every typed word must appear in the name or provider. cmdk's fuzzy default finds "openai" in Claude. */
function matches(value: string, search: string, keywords: string[] = []) {
	const text = [value, ...keywords].join(" ").toLowerCase();
	return search
		.toLowerCase()
		.split(/\s+/)
		.every((word) => text.includes(word))
		? 1
		: 0;
}

function ModelRow(props: {
	model: ModelOption;
	current: boolean;
	showPrice: boolean;
	providerLabel: string;
	onSelect: () => void;
}) {
	const { model, current, showPrice, providerLabel, onSelect } = props;
	return (
		<Tooltip open={showPrice}>
			<TooltipTrigger asChild>
				<CommandItem
					value={keyOf(model)}
					keywords={[model.label, providerLabel]}
					onSelect={onSelect}
					className={current ? "bg-accent font-medium data-[selected=true]:bg-accent" : undefined}
				>
					<span className="min-w-0 flex-1 truncate">{model.label}</span>
					<span className="sr-only">{priceLabel(model)}</span>
					<Badge
						variant="outline"
						aria-label={`${contextLabel(model.contextWindow)} context`}
						className="w-[38px] flex-none rounded-xs px-0 font-normal text-muted-foreground"
					>
						{contextLabel(model.contextWindow)}
					</Badge>
					<span className="size-4 flex-none">
						{current && <Check className="size-4 text-primary" strokeWidth={2.2} />}
					</span>
				</CommandItem>
			</TooltipTrigger>
			<TooltipContent side="left">{priceLabel(model)}</TooltipContent>
		</Tooltip>
	);
}

function ModelList(props: {
	providers: ProviderOption[];
	current?: ModelOption;
	onPick: (model: ModelOption) => void;
}) {
	const { providers, current, onPick } = props;
	const [highlighted, setHighlighted] = useState(current ? keyOf(current) : "");
	// The first row is highlighted on opening, and its price should wait until the learner moves.
	const [moved, setMoved] = useState(false);

	return (
		<Command
			filter={matches}
			value={highlighted}
			onValueChange={setHighlighted}
			onPointerMove={() => setMoved(true)}
			onPointerLeave={() => setMoved(false)}
			onKeyDown={(event) => {
				if (event.key === "ArrowDown" || event.key === "ArrowUp") setMoved(true);
			}}
		>
			<CommandInput placeholder="Search models" aria-label="Search models" />
			<CommandList className="max-h-[320px]">
				<CommandEmpty>No models found</CommandEmpty>
				{providers.map((provider) => (
					<CommandGroup key={provider.id} heading={provider.label}>
						{provider.models.map((model) => (
							<ModelRow
								key={keyOf(model)}
								model={model}
								providerLabel={provider.label}
								current={Boolean(current) && keyOf(model) === keyOf(current!)}
								showPrice={moved && highlighted === keyOf(model)}
								onSelect={() => onPick(model)}
							/>
						))}
					</CommandGroup>
				))}
			</CommandList>
		</Command>
	);
}

interface ModelPickerProps {
	providers: ProviderOption[];
	choice: ModelChoice;
	/** The row the menu lines up with, so it stays put whichever button opened it. */
	anchor: RefObject<HTMLDivElement | null>;
	disabled: boolean;
}

/** Floats over the composer, and lists the models of every connected provider. */
export function ModelPicker({ providers, choice, anchor, disabled }: ModelPickerProps) {
	const { model, chooseModel, pickerOpen: open, setPickerOpen: setOpen } = choice;

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverAnchor virtualRef={anchor} />
			<PopoverTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					disabled={disabled}
					aria-label={model ? `Model: ${model.label}` : "Choose a model"}
					className={`${MENU_TRIGGER} font-medium text-foreground`}
				>
					{model?.label ?? "Choose a model"}
					<ChevronDown className="size-3 text-muted-foreground" strokeWidth={2.8} />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				{...COMPOSER_MENU}
				className="w-[300px] overflow-hidden"
				onCloseAutoFocus={choice.onPickerCloseFocus}
			>
				{providers.length > 0 ? (
					<TooltipProvider>
						<ModelList
							providers={providers}
							current={model}
							onPick={(picked) => {
								chooseModel({ provider: picked.provider, id: picked.id }, !model);
								setOpen(false);
							}}
						/>
					</TooltipProvider>
				) : (
					<p className="flex h-[72px] items-center justify-center text-[13px] leading-4 text-muted-foreground">
						No providers are connected
					</p>
				)}
			</PopoverContent>
		</Popover>
	);
}
