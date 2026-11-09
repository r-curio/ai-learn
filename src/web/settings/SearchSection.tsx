import { useState } from "react";
import type { SearchServiceOption } from "../../shared/protocol.ts";
import { Notice } from "../components/Notice.tsx";
import { AddKeyRow, Section } from "./ProvidersView.tsx";
import { KeyAction } from "./VoiceSection.tsx";

const ROW =
	"flex h-[52px] items-center gap-2.5 pr-2.5 pl-3.5 not-last:border-b not-last:border-border";
const HINT = "text-[12px] leading-4 text-muted-foreground";

const HINTS: Record<string, string> = {
	tavily: "About 1,000 free searches a month. Get a key at tavily.com.",
};

function ServiceRow(props: {
	service: SearchServiceOption;
	canAddKey: boolean;
	onConnect: (key: string) => Promise<void>;
	onDisconnect: () => void;
}) {
	const { service } = props;
	const [adding, setAdding] = useState(false);
	if (adding)
		return (
			<AddKeyRow
				provider={service}
				onCancel={() => setAdding(false)}
				onSave={async (key) => {
					await props.onConnect(key);
					setAdding(false);
				}}
			/>
		);
	return (
		<div className={ROW}>
			<span className="flex min-w-0 flex-1 flex-col">
				<span className="text-[14px] leading-[18px] font-medium">{service.label}</span>
				<span className={HINT}>
					{service.connected ? "Connected." : (HINTS[service.id] ?? "Needs a key.")}
				</span>
			</span>
			<KeyAction
				engine={{ ...service, ownKey: true }}
				canAddKey={props.canAddKey}
				onAdd={() => setAdding(true)}
				onRemove={props.onDisconnect}
			/>
		</div>
	);
}

interface SearchSectionProps {
	services: SearchServiceOption[];
	keysUnavailable?: string;
	onConnect: (id: string, key: string) => Promise<void>;
	onDisconnect: (id: string) => void;
}

/** The key that lets the tutor search the web. Reading a page it already has a link to needs none. */
export function SearchSection(props: SearchSectionProps) {
	const { services, keysUnavailable, onConnect, onDisconnect } = props;
	return (
		<section aria-labelledby="search-heading" className="flex flex-col gap-5">
			<header className="flex flex-col gap-1">
				<h1 id="search-heading" className="text-[17px] leading-[25px] font-medium">
					Web search
				</h1>
				<p className="text-[13px] leading-[18px] text-muted-foreground">
					Lets the tutor check facts on the web. Without a key, it can still read a page from a
					link.
				</p>
			</header>
			<Section title="Search service">
				{services.map((service) => (
					<ServiceRow
						key={service.id}
						service={service}
						canAddKey={!keysUnavailable}
						onConnect={(key) => onConnect(service.id, key)}
						onDisconnect={() => onDisconnect(service.id)}
					/>
				))}
			</Section>
			{keysUnavailable && services.some(({ connected }) => !connected) && (
				<Notice>{keysUnavailable}</Notice>
			)}
		</section>
	);
}
