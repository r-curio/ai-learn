import { serve, type ServerType } from "@hono/node-server";
import { randomBytes } from "node:crypto";
import type { AddressInfo } from "node:net";
import { createClaudeEngine, type Engine } from "../harness/engine.ts";
import { createDemoEngine } from "../harness/fake-engine.ts";
import { createApp } from "./app.ts";

export interface StartOptions {
	dataDir: string;
	port?: number;
	token?: string;
	webRoot?: string;
	engine?: Engine;
}

export interface RunningServer {
	port: number;
	token: string;
	close(): Promise<void>;
}

export function chooseEngine(): Engine {
	return process.env.AI_LEARN_FAKE_MODEL === "1" ? createDemoEngine() : createClaudeEngine();
}

/** Start the server on loopback only. Port 0 picks any free port. */
export function startServer(options: StartOptions): Promise<RunningServer> {
	const token = options.token ?? randomBytes(32).toString("hex");
	const app = createApp({ engine: options.engine ?? chooseEngine(), dataDir: options.dataDir, token, webRoot: options.webRoot });
	return new Promise((resolve, reject) => {
		const server: ServerType = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: options.port ?? 0 }, (info) => {
			resolve({
				port: (info).port,
				token,
				close: () => new Promise((done) => server.close(() => done())),
			});
		});
		server.once("error", reject);
	});
}
