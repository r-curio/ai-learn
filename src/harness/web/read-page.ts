import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { WebToolError } from "./search-service.ts";

const TIMEOUT_MS = 15_000;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 5;

/** Addresses on the learner's own computer or network. A page could otherwise steer the tutor at their router or this app. */
const PRIVATE = new BlockList();
for (const [network, prefix] of [
	["0.0.0.0", 8],
	["10.0.0.0", 8],
	["100.64.0.0", 10],
	["127.0.0.0", 8],
	["169.254.0.0", 16],
	["172.16.0.0", 12],
	["192.0.0.0", 24],
	["192.168.0.0", 16],
	["198.18.0.0", 15],
	["224.0.0.0", 3],
] as const)
	PRIVATE.addSubnet(network, prefix, "ipv4");
for (const [network, prefix] of [
	["::", 127],
	["fc00::", 7],
	["fe80::", 10],
	["ff00::", 8],
] as const)
	PRIVATE.addSubnet(network, prefix, "ipv6");

/** IPv4 addresses written as IPv6, like ::ffff:7f00:1, are checked against the IPv4 rules too. */
export function isPrivateAddress(address: string): boolean {
	return PRIVATE.check(address, isIP(address) === 6 ? "ipv6" : "ipv4");
}

const refused = () =>
	new WebToolError(
		"That address is on the learner's own computer or network, so it can't be read.",
	);

/** Only public http and https pages. Every address the name points to is checked. */
async function checkTarget(raw: string): Promise<URL> {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		throw new WebToolError("That isn't a valid web address.");
	}
	if (url.protocol !== "http:" && url.protocol !== "https:")
		throw new WebToolError("Only http and https pages can be read.");
	const host = url.hostname.replace(/^\[|\]$/g, "");
	if (host === "localhost" || host.endsWith(".localhost")) throw refused();
	const addresses = isIP(host)
		? [host]
		: (await lookup(host, { all: true }).catch(() => [])).map(({ address }) => address);
	if (addresses.length === 0) throw new WebToolError(`Couldn't find ${host}.`);
	if (addresses.some(isPrivateAddress)) throw refused();
	return url;
}

/** Follow redirects by hand, so each new address is checked before it's requested. */
async function fetchPublic(
	raw: string,
	signal?: AbortSignal,
): Promise<{ response: Response; url: URL }> {
	const timeout = AbortSignal.timeout(TIMEOUT_MS);
	const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
	let url = await checkTarget(raw);
	for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
		const response = await fetch(url, {
			redirect: "manual",
			signal: combined,
			headers: { Accept: "text/html,application/xhtml+xml,text/plain;q=0.9" },
		}).catch(() => {
			throw new WebToolError(`Couldn't load ${url.hostname}.`);
		});
		const location = response.headers.get("location");
		if (response.status < 300 || response.status >= 400 || !location) return { response, url };
		await response.body?.cancel();
		url = await checkTarget(new URL(location, url).href);
	}
	throw new WebToolError("That page redirected too many times.");
}

/** The body, up to the size cap. A longer page is cut there rather than refused. */
async function readBody(response: Response): Promise<Uint8Array> {
	const chunks: Uint8Array[] = [];
	let size = 0;
	const reader = response.body?.getReader();
	while (reader && size < MAX_BYTES) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
		size += value.length;
	}
	await reader?.cancel();
	return Buffer.concat(chunks).subarray(0, MAX_BYTES);
}

function decode(bytes: Uint8Array, contentType: string): string {
	const charset = contentType.match(/charset=["']?([\w-]+)/i)?.[1] ?? "utf-8";
	try {
		return new TextDecoder(charset).decode(bytes);
	} catch {
		return new TextDecoder().decode(bytes);
	}
}

const tidy = (text: string) =>
	text
		.replace(/[ \t\u00a0]+/g, " ")
		.replace(/ *\n */g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();

/** The page's main text, as Firefox's reader view finds it, or all its text if that finds nothing. */
export function readableText(html: string): { title: string; text: string } {
	const { document } = parseHTML(html);
	const fallbackTitle = document.title ?? "";
	const article = new Readability(document).parse();
	if (article?.textContent?.trim())
		return { title: article.title || fallbackTitle, text: tidy(article.textContent) };
	return { title: fallbackTitle, text: tidy(document.body?.textContent ?? "") };
}

export interface ReadPage {
	url: string;
	title: string;
	text: string;
}

/** Fetch a public page and pull out its readable text. Nothing is sent but the request itself. */
export async function readPage(raw: string, signal?: AbortSignal): Promise<ReadPage> {
	const { response, url } = await fetchPublic(raw, signal);
	if (!response.ok) {
		await response.body?.cancel();
		throw new WebToolError(`${url.hostname} answered with status ${response.status}.`);
	}
	const contentType = response.headers.get("content-type") ?? "";
	const body = decode(await readBody(response), contentType);
	if (/html|xml/i.test(contentType)) return { url: url.href, ...readableText(body) };
	if (/^text\//i.test(contentType)) return { url: url.href, title: "", text: tidy(body) };
	throw new WebToolError("That page isn't a web page or plain text, so it can't be read.");
}
