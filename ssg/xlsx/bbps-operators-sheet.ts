import type { Worksheet } from "exceljs";
import {
	RATE_FORMAT,
	brandedTitle,
	footnoteRow,
	headerRow,
	introRow,
	protectSheet,
	type PricingXlsxData,
} from "./shared";

/**
 * Build the read-only "BBPS Operator Rates" sheet: the full operator-wise
 * commission list (instant settlement) with a frozen header and auto-filter.
 * Fixed commissions are ₹ values; percentage commissions render as %.
 */
export async function buildBbpsOperatorsSheet(
	ws: Worksheet,
	data: PricingXlsxData,
): Promise<void> {
	ws.columns = [
		{ width: 20 },
		{ width: 42 },
		{ width: 20 },
		{ width: 20 },
		{ width: 12 },
	];

	let row = 1;
	brandedTitle(
		ws,
		row,
		"E",
		"Eko Platform Services — BBPS Operator-wise Commission",
	);
	row++;

	const gstPct = Math.round(data.gstRate * 100);
	introRow(
		ws,
		row,
		"E",
		`Instant settlement. All values per transaction, exclusive of GST @ ${gstPct}%. Fixed commissions in ₹; percentage commissions as % of the amount.`,
	);
	row++;

	row++; // spacer

	const tableHeaderRow = row;
	headerRow(ws, row, [
		"Category",
		"Operator",
		"Comm ≤ ₹5,000",
		"Comm > ₹5,000",
		"Type",
	]);
	row++;

	for (const operator of data.bbps.operators) {
		ws.getCell(`A${row}`).value = operator.category;
		ws.getCell(`B${row}`).value = operator.operator;

		const upTo5k = ws.getCell(`C${row}`);
		const above5k = ws.getCell(`D${row}`);
		if (operator.type === "pct") {
			// Stored as percent numbers (2.56 = 2.56%); render as native % values
			upTo5k.value = operator.commUpTo5k / 100;
			upTo5k.numFmt = "0.00%";
			above5k.value = operator.commAbove5k / 100;
			above5k.numFmt = "0.00%";
		} else {
			upTo5k.value = operator.commUpTo5k;
			upTo5k.numFmt = RATE_FORMAT;
			above5k.value = operator.commAbove5k;
			above5k.numFmt = RATE_FORMAT;
		}

		ws.getCell(`E${row}`).value =
			operator.type === "pct" ? "% of amount" : "Fixed ₹";
		row++;
	}

	ws.autoFilter = {
		from: { row: tableHeaderRow, column: 1 },
		to: { row: row - 1, column: 5 },
	};

	row++; // spacer
	footnoteRow(
		ws,
		row,
		"E",
		"Rates subject to change based on operator terms. Bill processing may take up to 6 hours for standard BBPS.",
	);

	await protectSheet(ws);
}
