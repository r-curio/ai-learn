// Loads `.md` files as text under tsx, as esbuild does for the built server. Used by `npm test` and `npm run dev`.
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";

registerHooks({
	load(url, context, nextLoad) {
		if (!url.endsWith(".md")) return nextLoad(url, context);
		const text = readFileSync(new URL(url), "utf8");
		return {
			format: "module",
			source: `export default ${JSON.stringify(text)};`,
			shortCircuit: true,
		};
	},
});
