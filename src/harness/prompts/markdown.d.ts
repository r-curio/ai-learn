/** Prompt segments are imported as text: esbuild bundles them, and `scripts/markdown-imports.mjs` loads them under tsx. */
declare module "*.md" {
	const text: string;
	export default text;
}
