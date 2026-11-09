import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
	root: "src/web",
	plugins: [react(), tailwindcss()],
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
