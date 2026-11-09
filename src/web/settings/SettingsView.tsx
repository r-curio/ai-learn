import type { EngineStatus } from "../../shared/protocol.ts";
import { ProvidersView } from "./ProvidersView.tsx";
import type { useProviders } from "./useProviders.ts";
import { VoiceSection } from "./VoiceSection.tsx";

interface SettingsViewProps {
	status?: EngineStatus;
	providers: ReturnType<typeof useProviders>;
}

/** One scrolling page: providers first, since nothing works without one, then voice. */
export function SettingsView({ status, providers }: SettingsViewProps) {
	return (
		<div className="flex-1 overflow-y-auto">
			<div className="h-10 app-drag" />
			<main className="chat-column flex flex-col gap-10 pb-5">
				<ProvidersView
					connected={providers.connected}
					available={providers.available}
					keysUnavailable={status?.keysUnavailable}
					onConnect={providers.connect}
					onDisconnect={providers.disconnect}
				/>
				<VoiceSection
					engines={status?.voice ?? []}
					addable={providers.available}
					keysUnavailable={status?.keysUnavailable}
					onConnect={providers.connect}
				/>
			</main>
		</div>
	);
}
