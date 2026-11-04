import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { startServer } from "./index.ts";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const server = await startServer({
	dataDir: resolve(process.env.AI_LEARN_DATA_DIR ?? "data"),
	port: Number(process.env.AI_LEARN_PORT ?? 8787),
	token: process.env.AI_LEARN_TOKEN,
});
console.log(`\nOpen ai-learn: http://localhost:5173/#token=${server.token}\n`);
