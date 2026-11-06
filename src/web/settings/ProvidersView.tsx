import { Search } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "../components/button.tsx";
import { Input } from "../components/input.tsx";
import { Notice } from "../components/Notice.tsx";
import type { AddableProvider, ConnectedRow } from "./useProviders.ts";

const ROW =
	"flex h-[52px] items-center gap-2.5 pr-2.5 pl-3.5 not-last:border-b not-last:border-border";
const COUNT = "text-[12px] leading-4 text-muted-foreground tabular-nums";
const MODELS = (count: number) => `${count} ${count === 1 ? "model" : "models"}`;

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="flex flex-col gap-1.5">
			<h2 className="text-[13px] leading-4 font-normal text-muted-foreground">{title}</h2>
			<div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
				{children}
			</div>
		</section>
	);
}

function AddKeyRow({
	provider,
	onSave,
	onCancel,
}: {
	provider: AddableProvider;
	onSave: (key: string) => Promise<void>;
	onCancel: () => void;
}) {
	const [key, setKey] = useState("");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string>();

	function submit(event: FormEvent) {
		event.preventDefault();
		if (!key.trim() || saving) return;
		setSaving(true);
		setError(undefined);
		onSave(key.trim())
			.catch((cause: Error) => setError(cause.message))
			.finally(() => setSaving(false));
	}

	return (
		<form
			onSubmit={submit}
			className="flex flex-col gap-2.5 bg-background py-3 pr-2.5 pl-3.5 not-last:border-b not-last:border-border"
		>
			<div className="flex items-center justify-between pr-1">
				<span className="text-[14px] leading-[18px] font-medium">{provider.label}</span>
				<span className={COUNT}>{MODELS(provider.modelCount)}</span>
			</div>
			<div className="flex items-center gap-2">
				<Input
					type="password"
					autoFocus
					autoComplete="off"
					spellCheck={false}
					aria-label={`${provider.label} API key`}
					placeholder={`Paste your ${provider.label} API key`}
					value={key}
					onChange={(event) => setKey(event.target.value)}
				/>
				<Button variant="ghost" size="sm" className="h-9 px-2.5" onClick={onCancel}>
					Cancel
				</Button>
				<Button type="submit" className="h-9" disabled={!key.trim() || saving}>
					Save
				</Button>
			</div>
			{error && (
				<p role="alert" className="text-[13px] leading-[18px] text-destructive">
					{error}
				</p>
			)}
		</form>
	);
}

function ConnectedSection(props: {
	providers: ConnectedRow[];
	onDisconnect: (id: string) => void;
}) {
	return (
		<Section title="Connected">
			{props.providers.map((provider) => (
				<div className={ROW} key={provider.id}>
					<span className="flex-1 text-[14px] leading-[18px] font-medium">{provider.label}</span>
					<span className={COUNT}>{MODELS(provider.modelCount)}</span>
					{provider.keySource === "saved" ? (
						<Button
							variant="ghost"
							size="sm"
							className="h-8 px-2.5 text-muted-foreground"
							aria-label={`Remove ${provider.label}`}
							onClick={() => props.onDisconnect(provider.id)}
						>
							Remove
						</Button>
					) : (
						<span className={`${COUNT} px-2.5`}>From environment</span>
					)}
				</div>
			))}
		</Section>
	);
}

function AvailableSection(props: {
	providers: AddableProvider[];
	onConnect: (id: string, key: string) => Promise<void>;
}) {
	const [search, setSearch] = useState("");
	const [addingId, setAddingId] = useState<string>();
	const shown = props.providers.filter(({ label }) =>
		label.toLowerCase().includes(search.trim().toLowerCase()),
	);

	return (
		<Section title="Add a provider">
			<div className="flex h-11 flex-none items-center gap-2 border-b border-border px-3.5 transition-colors duration-150 ease-out focus-within:border-muted-foreground">
				<Search className="size-4 flex-none text-muted-foreground" strokeWidth={1.5} />
				<Input
					className="h-auto flex-1 rounded-none border-0 bg-transparent px-0"
					aria-label="Search providers"
					placeholder={`Search ${props.providers.length} providers`}
					value={search}
					onChange={(event) => setSearch(event.target.value)}
				/>
			</div>
			{shown.map((provider) =>
				provider.id === addingId ? (
					<AddKeyRow
						key={provider.id}
						provider={provider}
						onCancel={() => setAddingId(undefined)}
						onSave={async (key) => {
							await props.onConnect(provider.id, key);
							setAddingId(undefined);
						}}
					/>
				) : (
					<div className={ROW} key={provider.id}>
						<span className="flex-1 text-[14px] leading-[18px]">{provider.label}</span>
						<span className={COUNT}>{MODELS(provider.modelCount)}</span>
						<Button
							variant="outline"
							size="sm"
							className="h-8 px-2.5 text-foreground"
							aria-label={`Add ${provider.label} key`}
							onClick={() => setAddingId(provider.id)}
						>
							Add key
						</Button>
					</div>
				),
			)}
			{shown.length === 0 && (
				<p className="flex h-[60px] items-center justify-center text-[13px] leading-4 text-muted-foreground">
					No providers found
				</p>
			)}
		</Section>
	);
}

interface ProvidersViewProps {
	connected: ConnectedRow[];
	available: AddableProvider[];
	keysUnavailable?: string;
	onConnect: (id: string, key: string) => Promise<void>;
	onDisconnect: (id: string) => void;
}

/** Settings has one screen so far: connecting the providers whose models the picker lists. */
export function ProvidersView({
	connected,
	available,
	keysUnavailable,
	onConnect,
	onDisconnect,
}: ProvidersViewProps) {
	return (
		<div className="flex-1 overflow-y-auto">
			<div className="h-10 app-drag" />
			<main className="chat-column flex flex-col gap-5 pb-5">
				<header className="flex flex-col gap-1">
					<h1 className="text-[17px] leading-[25px] font-medium">Providers</h1>
					<p className="text-[13px] leading-[18px] text-muted-foreground">
						Add a key once to use a provider's models. Keys are encrypted with your computer's
						keychain, stay on this computer, and only go to that provider.
					</p>
				</header>
				{connected.length > 0 && (
					<ConnectedSection providers={connected} onDisconnect={onDisconnect} />
				)}
				{keysUnavailable ? (
					<Notice>{keysUnavailable}</Notice>
				) : (
					<AvailableSection providers={available} onConnect={onConnect} />
				)}
			</main>
		</div>
	);
}
