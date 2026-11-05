/** Enough of the file to fill a card, so a huge CSV is never read in full. */
const MAX_BYTES = 64 * 1024;
const MAX_ROWS = 6;
const MAX_COLUMNS = 4;

export const isCsv = (file: File) => file.type === "text/csv" || /\.csv$/i.test(file.name);

/** Read the first rows of a CSV, including quoted commas, quotes, and line breaks. */
export function parseCsvRows(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let cell = "";
	let quoted = false;
	const endCell = () => {
		if (row.length < MAX_COLUMNS) row.push(cell.trim());
		cell = "";
	};
	const endRow = () => {
		endCell();
		if (row.some(Boolean)) rows.push(row);
		row = [];
	};

	for (let i = 0; i < text.length && rows.length < MAX_ROWS; i++) {
		const char = text[i];
		if (quoted) {
			if (char !== '"') cell += char;
			else if (text[i + 1] === '"') cell += text[++i];
			else quoted = false;
		} else if (char === '"') quoted = true;
		else if (char === ",") endCell();
		else if (char === "\n") endRow();
		else if (char !== "\r") cell += char;
	}
	if (rows.length < MAX_ROWS) endRow();
	return rows;
}

export async function readCsvPreview(file: File): Promise<string[][]> {
	const text = await file.slice(0, MAX_BYTES).text();
	return parseCsvRows(text.replace(/^\uFEFF/, ""));
}
