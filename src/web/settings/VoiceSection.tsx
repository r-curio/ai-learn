import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import type { AddableProvider, VoiceEngineOption } from "../../shared/protocol.ts";
import { getPreferences, savePreferences } from "../api.ts";
import { Button } from "../components/button.tsx";
import { RadioGroup, RadioGroupItem } from "../components/form/radio-group.tsx";
import { Notice } from "../components/Notice.tsx";
import { AddKeyRow, Section } from "./ProvidersView.tsx";

const OFF = "off";
const ROW = "flex h-[52px] items-center gap-2.5 pr-2.5 not-last:border-b not-last:border-border";
const HINT = "text-[12px] leading-4 text-muted-foreground";

/** The saved voice engine. Nothing chosen, or one that's no longer offered, means off. */
function useVoiceChoice(engines: VoiceEngineOption[]) {
	const [chosen, setChosen] = useState<string>();
	const [error, setError] = useState<string>();
	useEffect(() => {
		getPreferences()
			.then((preferences) => setChosen(preferences.voice))
			.catch((cause: Error) => setError(cause.message));
	}, []);
	const choose = (id: string) => {
		const voice = id === OFF ? undefined : id;
		const previous = chosen;
		setChosen(voice);
		setError(undefined);
		savePreferences({ voice: voice ?? null }).catch((cause: Error) => {
			setChosen(previous);
			setError(cause.message);
		});
	};
	const usable = engines.some(({ id, connected }) => id === chosen && connected);
	return { value: usable && chosen ? chosen : OFF, choose, error };
}

function ChoiceRow(props: { value: string; label: string; hint: string; disabled?: boolean }) {
	return (
		<RadioGroupItem
			value={props.value}
			disabled={props.disabled}
			className="group flex min-w-0 flex-1 items-center gap-2.5 self-stretch pl-3.5 text-left"
		>
			<span className="flex w-4 flex-none justify-center">
				<Check
					className="size-4 text-primary opacity-0 transition-opacity duration-150 group-data-[state=checked]:opacity-100"
					strokeWidth={2}
				/>
			</span>
			<span className="flex min-w-0 flex-col">
				<span className="text-[14px] leading-[18px] font-medium">{props.label}</span>
				<span className={HINT}>{props.hint}</span>
			</span>
		</RadioGroupItem>
	);
}

/** A cloud engine. Without a key it can't be chosen, and offers to add one in place. */
function EngineRow(props: {
	engine: VoiceEngineOption;
	canAddKey: boolean;
	onConnect: (key: string) => Promise<void>;
}) {
	const { engine } = props;
	const [adding, setAdding] = useState(false);
	if (adding)
		return (
			<AddKeyRow
				provider={engine}
				onCancel={() => setAdding(false)}
				onSave={async (key) => {
					await props.onConnect(key);
					setAdding(false);
				}}
			/>
		);
	return (
		<div className={ROW}>
			<ChoiceRow
				value={engine.id}
				label={engine.label}
				hint={`Sends your recording to ${engine.label}.`}
				disabled={!engine.connected}
			/>
			{!engine.connected && props.canAddKey && (
				<Button
					variant="outline"
					size="sm"
					className="h-8 px-2.5 text-foreground"
					aria-label={`Add ${engine.label} key`}
					onClick={() => setAdding(true)}
				>
					Add key
				</Button>
			)}
		</div>
	);
}

interface VoiceSectionProps {
	engines: VoiceEngineOption[];
	addable: AddableProvider[];
	keysUnavailable?: string;
	onConnect: (id: string, key: string) => Promise<void>;
}

/** How the learner's speech becomes text. The recording goes to the engine chosen here. */
export function VoiceSection({ engines, addable, keysUnavailable, onConnect }: VoiceSectionProps) {
	const { value, choose, error } = useVoiceChoice(engines);

	return (
		<section aria-labelledby="voice-heading" className="flex flex-col gap-5">
			<header className="flex flex-col gap-1">
				<h1 id="voice-heading" className="text-[17px] leading-[25px] font-medium">
					Voice
				</h1>
				<p className="text-[13px] leading-[18px] text-muted-foreground">
					Speak instead of typing. Choose where your recording is turned into text.
				</p>
			</header>
			<Section title="Speech to text">
				<RadioGroup
					value={value}
					onValueChange={choose}
					className="gap-0"
					aria-label="Speech to text"
				>
					<div className={ROW}>
						<ChoiceRow value={OFF} label="Off" hint="Voice input is off." />
					</div>
					{engines.map((engine) => (
						<EngineRow
							key={engine.id}
							engine={engine}
							canAddKey={!keysUnavailable && addable.some(({ id }) => id === engine.id)}
							onConnect={(key) => onConnect(engine.id, key)}
						/>
					))}
				</RadioGroup>
			</Section>
			{keysUnavailable && engines.some(({ connected }) => !connected) && (
				<Notice>{keysUnavailable}</Notice>
			)}
			{error && (
				<p role="alert" className="text-[13px] leading-[18px] text-destructive">
					{error}
				</p>
			)}
		</section>
	);
}
