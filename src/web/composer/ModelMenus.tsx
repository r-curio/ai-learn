import { cn } from "cn";
import { ChevronDown } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "../components/button.tsx";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "../components/dropdown-menu.tsx";
import { EFFORT_LABELS, MODELS, type Effort, type ModelChoice } from "./useModelChoice.ts";

/** How far above the composer's top edge a menu sits, from frames 04 and 05. */
const GAP_ABOVE_COMPOSER = 8;

interface ChoiceMenuProps {
	triggerLabel: string;
	/** What the trigger is for, when its text alone doesn't say. */
	ariaLabel?: string;
	triggerClassName: string;
	menuClassName: string;
	options: { value: string; label: string }[];
	value: string;
	disabled: boolean;
	onChange: (value: string) => void;
}

function ChoiceMenu(props: ChoiceMenuProps) {
	const { triggerLabel, ariaLabel, triggerClassName, menuClassName } = props;
	const { options, value, disabled, onChange } = props;
	const trigger = useRef<HTMLButtonElement>(null);
	const [sideOffset, setSideOffset] = useState(GAP_ABOVE_COMPOSER);

	// The menu anchors to its trigger but sits above the whole composer, which grows with its text.
	function clearComposer(open: boolean) {
		const composer = trigger.current?.closest("[data-slot=composer]");
		if (!open || !trigger.current || !composer) return;
		const overlap =
			trigger.current.getBoundingClientRect().top - composer.getBoundingClientRect().top;
		setSideOffset(overlap + GAP_ABOVE_COMPOSER);
	}

	return (
		<DropdownMenu modal={false} onOpenChange={clearComposer}>
			<DropdownMenuTrigger asChild>
				<Button
					ref={trigger}
					variant="ghost"
					size="sm"
					aria-label={ariaLabel}
					disabled={disabled}
					className={cn("h-8 gap-1.5 rounded-md px-[7px] text-[13px] leading-4", triggerClassName)}
				>
					{triggerLabel}
					<ChevronDown className="size-3 text-muted-foreground" strokeWidth={2.8} />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent side="top" align="end" sideOffset={sideOffset} className={menuClassName}>
				<DropdownMenuRadioGroup value={value} onValueChange={onChange}>
					{options.map((option) => (
						<DropdownMenuRadioItem key={option.value} value={option.value}>
							{option.label}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

interface ModelMenusProps {
	choice: ModelChoice;
	disabled: boolean;
}

/** The Model and Effort menus in the composer, from frames 04 and 05. */
export function ModelMenus({ choice, disabled }: ModelMenusProps) {
	const { model, effort, chooseModel, setEffort } = choice;

	return (
		<>
			<ChoiceMenu
				triggerLabel={model.label}
				ariaLabel={`Model: ${model.label}`}
				triggerClassName="font-medium text-foreground"
				menuClassName="w-[220px]"
				options={MODELS.map(({ id, label }) => ({ value: id, label }))}
				value={model.id}
				disabled={disabled}
				onChange={chooseModel}
			/>
			<ChoiceMenu
				triggerLabel={`${EFFORT_LABELS[effort]} effort`}
				triggerClassName="font-normal text-muted-foreground aria-expanded:text-muted-foreground"
				menuClassName="w-[180px]"
				options={model.efforts.map((level) => ({ value: level, label: EFFORT_LABELS[level] }))}
				value={effort}
				disabled={disabled}
				onChange={(level) => setEffort(level as Effort)}
			/>
		</>
	);
}
