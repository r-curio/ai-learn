#!/usr/bin/env node
/**
 * Enforces the size and folder limits in CONTRIBUTING.md across tracked files.
 * Warnings are printed for the PR author to explain. Errors block the commit and CI.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname } from "node:path";

const FILE_LINES = { warn: 300, error: 400 };
const FOLDER_FILES = { warn: 10, error: 15 };
const FOLDER_LINES = { warn: 1500 };
const DEPTH_BELOW_SRC = { warn: 3, error: 4 };
const SOURCE = /\.(ts|tsx|js|mjs|cjs|css)$/;

/** Files allowed past a hard limit for now. Each one must name the issue that removes it. */
const EXCEPTIONS = new Map([
	["src/web/App.tsx", "#3"],
	["src/web/styles.css", "#3"],
]);

const isTest = (path) => path.startsWith("tests/");
const isExempt = (path) => path.startsWith("tests/fixtures/");

const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
	encoding: "utf8",
})
	.split("\n")
	.filter((path) => SOURCE.test(path) && !isExempt(path));

const warnings = [];
const errors = [];
const folders = new Map();

for (const path of files) {
	let lines;
	try {
		lines = readFileSync(path, "utf8").split("\n").length - 1;
	} catch {
		continue; // Deleted in the working tree but not yet staged.
	}
	const folder = dirname(path);
	const totals = folders.get(folder) ?? { files: 0, lines: 0 };
	folders.set(folder, { files: totals.files + 1, lines: totals.lines + lines });

	if (lines > FILE_LINES.error && !isTest(path)) {
		if (EXCEPTIONS.has(path)) {
			warnings.push(`${path}: ${lines} lines, allowed until ${EXCEPTIONS.get(path)} is done`);
		} else {
			errors.push(`${path}: ${lines} lines (limit ${FILE_LINES.error}). Split it.`);
		}
	} else if (lines > FILE_LINES.warn) {
		warnings.push(`${path}: ${lines} lines (over ${FILE_LINES.warn}). Explain it or split it.`);
	}
}

for (const [folder, totals] of folders) {
	if (totals.files > FOLDER_FILES.error) {
		errors.push(`${folder}/: ${totals.files} files (limit ${FOLDER_FILES.error}). Group them.`);
	} else if (totals.files > FOLDER_FILES.warn) {
		warnings.push(`${folder}/: ${totals.files} files (over ${FOLDER_FILES.warn}).`);
	}
	if (totals.lines > FOLDER_LINES.warn && !isTest(`${folder}/`)) {
		warnings.push(`${folder}/: ${totals.lines} lines in total (over ${FOLDER_LINES.warn}).`);
	}
	if (folder.startsWith("src/")) {
		const depth = folder.split("/").length - 1;
		if (depth >= DEPTH_BELOW_SRC.error) {
			errors.push(`${folder}/: ${depth} levels below src/ (limit ${DEPTH_BELOW_SRC.error - 1}).`);
		} else if (depth >= DEPTH_BELOW_SRC.warn) {
			warnings.push(`${folder}/: ${depth} levels below src/. Explain it or flatten it.`);
		}
	}
}

for (const [path, issue] of EXCEPTIONS) {
	if (!files.includes(path)) errors.push(`Remove the exception for ${path} (${issue}): it's gone.`);
}

for (const message of warnings) console.warn(`warning: ${message}`);
for (const message of errors) console.error(`error: ${message}`);
console.log(`Structure check: ${errors.length} errors, ${warnings.length} warnings.`);
process.exit(errors.length > 0 ? 1 : 0);
