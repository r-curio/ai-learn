import type { AttachmentInfo, EngineStatus, RunEvent } from "../shared/protocol.ts";

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
	return (await request("/api/status")).json();
}

export async function createSession(): Promise<string> {
	const { id } = (await (await request("/api/sessions", { method: "POST" })).json()) as { id: string };
	return id;
}

export async function uploadAttachment(sessionId: string, file: File): Promise<AttachmentInfo> {
	const form = new FormData();
	form.set("file", file);
	return (await request(`/api/sessions/${sessionId}/attachments`, { method: "POST", body: form })).json();
}

export async function abortRun(sessionId: string): Promise<void> {
	await request(`/api/sessions/${sessionId}/abort`, { method: "POST" });
}

/** Send a message and call `onEvent` for each server-sent event until the run ends. */
export async function sendMessage(
	sessionId: string,
	body: { text: string; attachmentIds: string[] },
	onEvent: (event: RunEvent) => void,
): Promise<void> {
	const response = await request(`/api/sessions/${sessionId}/messages`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
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
