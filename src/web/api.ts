import type {
	AttachmentInfo,
	EngineStatus,
	ModelSelection,
	Preferences,
	RunEvent,
	SessionSummary,
	SessionView,
} from "../shared/protocol.ts";

const STORAGE_KEY = "ai-learn-token";

function readToken(): string {
	const match = location.hash.match(/token=([a-zA-Z0-9-_]+)/);
	if (match?.[1]) {
		try {
			sessionStorage.setItem(STORAGE_KEY, match[1]);
		} catch {
			// Storage can be unavailable. The token stays in memory for this page load.
		}
		history.replaceState(null, "", location.pathname);
		return match[1];
	}
	try {
		return sessionStorage.getItem(STORAGE_KEY) ?? "";
	} catch {
		return "";
	}
}

const token = readToken();

async function request(path: string, init: RequestInit = {}): Promise<Response> {
	const response = await fetch(path, {
		...init,
		headers: { ...init.headers, Authorization: `Bearer ${token}` },
	});
	if (!response.ok) {
		const body = (await response.json().catch(() => undefined)) as { error?: string } | undefined;
		throw new Error(body?.error ?? `Request failed (${response.status}).`);
	}
	return response;
}

export async function getStatus(): Promise<EngineStatus> {
	return (await request("/api/status")).json() as Promise<EngineStatus>;
}

export async function getPreferences(): Promise<Preferences> {
	return (await request("/api/preferences")).json() as Promise<Preferences>;
}

export async function savePreferences(preferences: Partial<Preferences>): Promise<void> {
	await request("/api/preferences", {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(preferences),
	});
}

/** The key goes one way: nothing from the server ever contains it. */
export async function saveProviderKey(providerId: string, key: string): Promise<void> {
	await request(`/api/providers/${encodeURIComponent(providerId)}/key`, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ key }),
	});
}

export async function removeProviderKey(providerId: string): Promise<void> {
	await request(`/api/providers/${encodeURIComponent(providerId)}/key`, { method: "DELETE" });
}

export async function createSession(): Promise<string> {
	const { id } = (await (await request("/api/sessions", { method: "POST" })).json()) as {
		id: string;
	};
	return id;
}

export async function listSessions(): Promise<SessionSummary[]> {
	return (await request("/api/sessions")).json() as Promise<SessionSummary[]>;
}

export async function getSession(id: string): Promise<SessionView> {
	return (await request(`/api/sessions/${id}`)).json() as Promise<SessionView>;
}

export async function deleteSession(id: string): Promise<void> {
	await request(`/api/sessions/${id}`, { method: "DELETE" });
}

/** Images need the auth header, so they load as blobs rather than through a plain src URL. */
export async function fetchImageUrl(sessionId: string, attachmentId: string): Promise<string> {
	const blob = await (
		await request(`/api/sessions/${sessionId}/attachments/${attachmentId}`)
	).blob();
	return URL.createObjectURL(blob);
}

export async function uploadAttachment(sessionId: string, file: File): Promise<AttachmentInfo> {
	const form = new FormData();
	form.set("file", file);
	return (
		await request(`/api/sessions/${sessionId}/attachments`, { method: "POST", body: form })
	).json() as Promise<AttachmentInfo>;
}

export async function abortRun(sessionId: string): Promise<void> {
	await request(`/api/sessions/${sessionId}/abort`, { method: "POST" });
}

export function sendMessage(
	sessionId: string,
	body: { text: string; attachmentIds: string[]; model: ModelSelection },
	onEvent: (event: RunEvent) => void,
): Promise<void> {
	return streamRun(
		request(`/api/sessions/${sessionId}/messages`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		}),
		onEvent,
	);
}

export function retryRun(
	sessionId: string,
	model: ModelSelection,
	onEvent: (event: RunEvent) => void,
): Promise<void> {
	return streamRun(
		request(`/api/sessions/${sessionId}/retry`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ model }),
		}),
		onEvent,
	);
}

/** Read server-sent events and call `onEvent` for each until the run ends. */
async function streamRun(
	pending: Promise<Response>,
	onEvent: (event: RunEvent) => void,
): Promise<void> {
	const response = await pending;
	const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
	let buffer = "";
	for (;;) {
		const { done, value } = await reader.read();
		if (done) return;
		buffer += value;
		let boundary: number;
		while ((boundary = buffer.indexOf("\n\n")) !== -1) {
			const frame = buffer.slice(0, boundary);
			buffer = buffer.slice(boundary + 2);
			const data = frame
				.split("\n")
				.filter((line) => line.startsWith("data:"))
				.map((line) => line.slice(5).trimStart())
				.join("\n");
			if (data) onEvent(JSON.parse(data) as RunEvent);
		}
	}
}
