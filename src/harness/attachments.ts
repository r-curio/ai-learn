import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ImageContent, TextContent } from "@earendil-works/pi-ai";
import type { AttachmentInfo, AttachmentKind } from "../shared/protocol.ts";

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** About 7,500 tokens. Larger files stay out of the history, and the model reads them on demand. */
export const INLINE_TEXT_CHARS = 30_000;
const MAX_PDF_PAGES = 1000;

export class AttachmentError extends Error {
	constructor(
		readonly status: 400 | 413 | 415 | 422,
		message: string,
	) {
		super(message);
	}
}

interface SavedAttachment {
	info: AttachmentInfo;
	text?: string;
	mimeType?: string;
}

interface Stored extends AttachmentInfo {
	text?: string;
	image?: { data: string; mimeType: string };
}

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
	return signature.every((byte, index) => bytes[offset + index] === byte);
}

/** Identify a file by its contents. The name and browser-supplied type are not trusted. */
export function detectType(
	bytes: Uint8Array,
): { kind: AttachmentKind; mimeType: string } | undefined {
	if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return { kind: "image", mimeType: "image/png" };
	if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { kind: "image", mimeType: "image/jpeg" };
	if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return { kind: "image", mimeType: "image/gif" };
	if (
		startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
		startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
	) {
		return { kind: "image", mimeType: "image/webp" };
	}
	if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]))
		return { kind: "pdf", mimeType: "application/pdf" };
	if (bytes.includes(0)) return undefined;
	try {
		new TextDecoder("utf-8", { fatal: true }).decode(bytes);
		return { kind: "text", mimeType: "text/plain" };
	} catch {
		return undefined;
	}
}

export function sanitizeName(raw: string): string {
	const base = raw.split(/[/\\]/).at(-1) ?? "";
	// Control characters are exactly what this removes from names.
	const clean = base
		// eslint-disable-next-line no-control-regex
		.replace(/[\u0000-\u001f\u007f<>"&']/g, "")
		.trim()
		.slice(0, 120);
	return clean || "attachment";
}

async function extractPdfText(bytes: Uint8Array): Promise<string> {
	const { getDocument, VerbosityLevel } = await import("pdfjs-dist/legacy/build/pdf.mjs");
	// pdf.js takes ownership of the buffer it is given, so hand it a copy.
	const task = getDocument({
		data: bytes.slice(),
		verbosity: VerbosityLevel.ERRORS,
		disableFontFace: true,
	});
	const document = await task.promise;
	try {
		if (document.numPages > MAX_PDF_PAGES) {
			throw new AttachmentError(
				413,
				`This PDF has ${document.numPages} pages. The limit is ${MAX_PDF_PAGES}.`,
			);
		}
		const pages: string[] = [];
		for (let number = 1; number <= document.numPages; number++) {
			const page = await document.getPage(number);
			const content = await page.getTextContent();
			const text = content.items
				.map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : " ") : ""))
				.join("")
				.trim();
			pages.push(`[Page ${number}]\n${text}`);
			page.cleanup();
		}
		return pages.join("\n\n");
	} finally {
		await task.destroy();
	}
}

function neutralize(text: string): string {
	return text.replaceAll("</attachment", "<\\/attachment");
}

/** Holds one session's uploads. Originals are kept on disk under `dir`. */
export class AttachmentStore {
	private readonly items = new Map<string, Stored>();

	constructor(private readonly dir: string) {}

	/** Restore everything saved in `dir`. A half-written upload has no metadata file, so it's skipped. */
	async load(): Promise<void> {
		const names = await readdir(this.dir).catch(() => [] as string[]);
		for (const name of names.filter((entry) => entry.endsWith(".json"))) {
			const saved = JSON.parse(await readFile(join(this.dir, name), "utf8")) as SavedAttachment;
			const stored: Stored = { ...saved.info, text: saved.text };
			if (saved.mimeType) {
				const bytes = await readFile(join(this.dir, saved.info.id));
				stored.image = { data: bytes.toString("base64"), mimeType: saved.mimeType };
			}
			this.items.set(saved.info.id, stored);
		}
	}

	async add(rawName: string, bytes: Uint8Array): Promise<AttachmentInfo> {
		const name = sanitizeName(rawName);
		if (bytes.length === 0) throw new AttachmentError(400, `${name} is empty.`);
		if (bytes.length > MAX_FILE_BYTES)
			throw new AttachmentError(413, `${name} is over the 25 MB limit.`);
		const type = detectType(bytes);
		if (!type)
			throw new AttachmentError(
				415,
				`${name} isn't a supported file. Use an image, a PDF, or a text file.`,
			);

		const id = randomUUID();
		const stored: Stored = { id, name, kind: type.kind, size: bytes.length };
		if (type.kind === "image") {
			if (bytes.length > MAX_IMAGE_BYTES)
				throw new AttachmentError(413, `${name} is over the 5 MB image limit.`);
			stored.image = { data: Buffer.from(bytes).toString("base64"), mimeType: type.mimeType };
		} else if (type.kind === "pdf") {
			const text = await this.readPdf(name, bytes);
			if (!/\S/.test(text.replace(/\[Page \d+\]/g, ""))) {
				throw new AttachmentError(
					422,
					`${name} has no readable text. Scanned PDFs aren't supported yet.`,
				);
			}
			stored.text = text;
		} else {
			stored.text = new TextDecoder().decode(bytes);
		}

		const info: AttachmentInfo = { id, name, kind: stored.kind, size: stored.size };
		const saved: SavedAttachment = { info, text: stored.text, mimeType: stored.image?.mimeType };
		await mkdir(this.dir, { recursive: true });
		await writeFile(join(this.dir, id), bytes);
		// The metadata goes last and atomically, so its presence means the upload is complete.
		await writeFile(join(this.dir, `${id}.json.tmp`), JSON.stringify(saved));
		await rename(join(this.dir, `${id}.json.tmp`), join(this.dir, `${id}.json`));
		this.items.set(id, stored);
		return info;
	}

	private async readPdf(name: string, bytes: Uint8Array): Promise<string> {
		try {
			return await extractPdfText(bytes);
		} catch (error) {
			if (error instanceof AttachmentError) throw error;
			throw new AttachmentError(422, `${name} couldn't be read as a PDF.`);
		}
	}

	has(id: string): boolean {
		return this.items.has(id);
	}

	info(id: string): AttachmentInfo | undefined {
		const item = this.items.get(id);
		return item && { id: item.id, name: item.name, kind: item.kind, size: item.size };
	}

	image(id: string): { bytes: Buffer; mimeType: string } | undefined {
		const image = this.items.get(id)?.image;
		return image && { bytes: Buffer.from(image.data, "base64"), mimeType: image.mimeType };
	}

	imageData(id: string): string | undefined {
		return this.items.get(id)?.image?.data;
	}

	/** Find which attachment an image block came from, so the log can store a reference to it. */
	idForImage(data: string): string | undefined {
		for (const item of this.items.values()) if (item.image?.data === data) return item.id;
		return undefined;
	}

	/** Build the message content that puts these attachments in front of the model. */
	toContent(ids: string[]): (TextContent | ImageContent)[] {
		return ids.flatMap((id): (TextContent | ImageContent)[] => {
			const item = this.items.get(id);
			if (!item) throw new AttachmentError(400, `Unknown attachment: ${id}`);
			const open = `<attachment id="${item.id}" name="${item.name}" kind="${item.kind}"`;
			if (item.image) {
				return [
					{ type: "text", text: `${open} />` },
					{ type: "image", data: item.image.data, mimeType: item.image.mimeType },
				];
			}
			const text = item.text ?? "";
			const shown = text.slice(0, INLINE_TEXT_CHARS);
			const note =
				text.length > shown.length
					? `\n[Showing ${shown.length} of ${text.length} characters. Call read_attachment with offset ${shown.length} for more.]`
					: "";
			return [{ type: "text", text: `${open}>\n${neutralize(shown)}${note}\n</attachment>` }];
		});
	}

	/** Read part of an attachment for the read_attachment tool. */
	read(id: string, offset = 0, limit = INLINE_TEXT_CHARS): (TextContent | ImageContent)[] {
		const item = this.items.get(id);
		if (!item) throw new Error(`Unknown attachment: ${id}`);
		if (item.image)
			return [{ type: "image", data: item.image.data, mimeType: item.image.mimeType }];
		const text = item.text ?? "";
		const end = Math.min(offset + limit, text.length);
		const more =
			end < text.length
				? `\n[Continues. Next offset: ${end}. Total: ${text.length} characters.]`
				: "\n[End of attachment.]";
		return [{ type: "text", text: text.slice(offset, end) + more }];
	}
}
