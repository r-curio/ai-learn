import type { EngineStatus } from "../../shared/protocol.ts";
import { SegmentedTabs } from "../components/tabs.tsx";
import { ProvidersView } from "./ProvidersView.tsx";
import type { useProviders } from "./useProviders.ts";
import { VoiceSection } from "./VoiceSection.tsx";

export type SettingsPage = "providers" | "voice";

const PAGES = [
	{ value: "providers", label: "Providers" },
	{ value: "voice", label: "Voice" },
] as const;

interface SettingsViewProps {
	status?: EngineStatus;
	providers: ReturnType<typeof useProviders>;
	/** The open tab is kept outside, so the composer can open Voice directly. */
	page: SettingsPage;
	onPageChange: (page: SettingsPage) => void;
}

/** Providers come first, since nothing works without one. The provider list is long, so voice gets its own tab. */
export function SettingsView({ status, providers, page, onPageChange }: SettingsViewProps) {
	return (
		<div className="flex-1 overflow-y-auto">
			<div className="h-10 app-drag" />
			<main className="chat-column flex flex-col gap-5 pb-5">
				<SegmentedTabs
					label="Settings"
					className="w-[240px]"
					value={page}
					options={PAGES}
					onChange={onPageChange}
				/>
				{page === "providers" ? (
					<ProvidersView
						connected={providers.connected}
						available={providers.available}
						keysUnavailable={status?.keysUnavailable}
						onConnect={providers.connect}
						onDisconnect={providers.disconnect}
					/>
				) : (
					<VoiceSection
						engines={status?.voice ?? []}
						addable={providers.available}
						keysUnavailable={status?.keysUnavailable}
						onConnect={providers.connect}
					/>
				)}
			</main>
		</div>
	);
}
