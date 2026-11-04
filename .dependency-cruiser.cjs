/** Which parts of the app may depend on which. See CONTRIBUTING.md. */
module.exports = {
	forbidden: [
		{
			name: "web-stays-in-the-browser",
			comment: "The UI talks to the harness and server over HTTP only.",
			severity: "error",
			from: { path: "^src/web" },
			to: { path: "^src/(harness|server)" },
		},
		{
			name: "harness-knows-no-transport",
			comment: "The harness must work without a server or UI.",
			severity: "error",
			from: { path: "^src/harness" },
			to: { path: "^src/(server|web)" },
		},
		{
			name: "server-has-no-ui",
			severity: "error",
			from: { path: "^src/server" },
			to: { path: "^src/web" },
		},
		{
			name: "shared-stays-a-leaf",
			comment: "Shared code is imported by the app and imports nothing from it.",
			severity: "error",
			from: { path: "^src/shared" },
			to: { path: "^src/(harness|server|web)" },
		},
		{
			name: "no-circular",
			severity: "error",
			from: {},
			to: { circular: true, viaOnly: { dependencyTypesNot: ["type-only"] } },
		},
	],
	options: {
		doNotFollow: { path: "node_modules" },
		tsPreCompilationDeps: true,
		tsConfig: { fileName: "tsconfig.json" },
		enhancedResolveOptions: { extensions: [".ts", ".tsx", ".js", ".mjs", ".css"] },
	},
};
