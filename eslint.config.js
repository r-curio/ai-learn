import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
	{ ignores: ["dist/", "data/", ".playwright-mcp/", ".worktrees/"] },
	js.configs.recommended,
	{
		files: ["**/*.{ts,tsx}"],
		extends: [tseslint.configs.recommendedTypeChecked],
		languageOptions: {
			parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
		},
		rules: {
			// Interfaces like Pi's tools require a Promise, even when the work is synchronous.
			"@typescript-eslint/require-await": "off",
			// Promises must be awaited or explicitly dropped with `void`, in a form that allows async handlers.
			"@typescript-eslint/no-misused-promises": [
				"error",
				{ checksVoidReturn: { attributes: false } },
			],
		},
	},
	{
		files: ["src/web/**/*.{ts,tsx}"],
		extends: [reactHooks.configs.flat.recommended],
	},
	{
		files: ["src/**/*.{ts,tsx}"],
		rules: {
			"max-lines-per-function": [
				"warn",
				{ max: 60, skipBlankLines: true, skipComments: true, IIFEs: true },
			],
		},
	},
	{
		// node:test runs the promise that test() returns, so nothing needs to await it.
		files: ["tests/**/*.ts"],
		rules: { "@typescript-eslint/no-floating-promises": "off" },
	},
	{
		files: ["electron/**/*.mjs", "scripts/**/*.mjs", "*.js", "*.cjs"],
		languageOptions: { globals: globals.node },
	},
	prettier,
);
