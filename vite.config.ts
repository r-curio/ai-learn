import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { createReadStream, existsSync } from "node:fs";
import { cp } from "node:fs/promises";
import { join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const EXCALIDRAW_FONTS = fileURLToPath(
	new URL("node_modules/@excalidraw/excalidraw/dist/prod/fonts", import.meta.url),
);

/** Excalidraw's fonts are served by the app at /excalidraw/fonts, never fetched from its CDN. */
function excalidrawFonts(): Plugin {
	let outDir = "";
	return {
		name: "excalidraw-fonts",
		configResolved: (config) => void (outDir = resolve(config.root, config.build.outDir)),
		configureServer(server) {
			server.middlewares.use("/excalidraw/fonts", (req, res, next) => {
				const file = join(EXCALIDRAW_FONTS, normalize(decodeURIComponent(req.url ?? "")));
				if (!file.startsWith(EXCALIDRAW_FONTS) || !existsSync(file)) return next();
				res.setHeader("Content-Type", "font/woff2");
				createReadStream(file).pipe(res);
			});
		},
		writeBundle: () => cp(EXCALIDRAW_FONTS, join(outDir, "excalidraw/fonts"), { recursive: true }),
	};
}

export default defineConfig({
	root: "src/web",
	plugins: [react(), tailwindcss(), excalidrawFonts()],
	resolve: { alias: { "@": fileURLToPath(new URL("src/web", import.meta.url)) } },
	build: {
		outDir: "../../dist/web",
		emptyOutDir: true,
		// The CSP allows fonts only from the app itself, so a small font can't become a data: URI.
		assetsInlineLimit: (file) => (/\.(woff2?|ttf)$/.test(file) ? false : undefined),
	},
	server: {
		port: 5173,
		strictPort: true,
		proxy: { "^/api/": "http://127.0.0.1:8787" },
	},
});
