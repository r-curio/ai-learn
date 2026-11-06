import { Item, ItemContent, ItemMedia } from "../components/item.tsx";
import { RadioGroup, RadioGroupItem } from "../components/form/radio-group.tsx";

const letter = (index: number) => String.fromCharCode(65 + index);

/**
 * The chosen row's thicker border takes its extra width from the padding, so nothing moves. The
 * text sits at the top with the chip, so a long choice wraps below its first line.
 */
const ROW =
	"cursor-pointer items-start gap-2.5 px-2.5 py-[7px] text-left text-[14px] leading-[18px] hover:bg-muted data-[state=checked]:border-[1.5px] data-[state=checked]:border-primary data-[state=checked]:bg-accent data-[state=checked]:px-[9.5px] data-[state=checked]:py-[6.5px] data-[state=checked]:hover:bg-accent";

const CHIP =
	"size-[22px] rounded-sm bg-muted text-[12px] leading-4 font-medium text-muted-foreground transition-colors duration-[250ms] ease-spring-highlight group-data-[state=checked]/item:bg-primary group-data-[state=checked]/item:text-primary-foreground";

export function AnswerChoices({
	choices,
	selected,
	onSelect,
}: {
	choices: string[];
	selected?: number;
	onSelect: (index: number) => void;
}) {
	return (
		<RadioGroup
			aria-label="Answers"
			value={selected === undefined ? "" : String(selected)}
			onValueChange={(value) => onSelect(Number(value))}
		>
			{choices.map((choice, index) => (
				<Item key={index} asChild variant="outline" className={ROW}>
					<RadioGroupItem value={String(index)}>
						<ItemMedia className={CHIP}>{letter(index)}</ItemMedia>
						<ItemContent className="min-w-0 pt-0.5 wrap-anywhere">{choice}</ItemContent>
					</RadioGroupItem>
				</Item>
			))}
		</RadioGroup>
	);
}
