import type { Worksheet } from "exceljs";
import {
	HEADER_FILL,
	NAVY,
	SHEETS,
	brandedTitle,
	footnoteRow,
	fullWidthRow,
	introRow,
	protectSheet,
	solidFill,
	type PricingXlsxData,
} from "./shared";

/** TOC entries: sheet name + what it's for, in workbook tab order. */
const TOC: { sheet: string; purpose: string }[] = [
	{
		sheet: SHEETS.verificationCalculator,
		purpose:
			"Estimate your monthly COST for verification APIs (PAN, bank, GST, UPI…) — enter monthly volumes.",
	},
	{
		sheet: SHEETS.paymentsEarnings,
		purpose:
			"Estimate your monthly EARNINGS from DMT, AePS and BBPS — these products pay you a commission per transaction.",
	},
	{
		sheet: SHEETS.connectedBanking,
		purpose:
			"Estimate Connected Banking costs — one-time setup per bank per user plus per-transaction charges.",
	},
	{
		sheet: SHEETS.verificationRateCard,
		purpose: "Static reference: every verification API and its rate.",
	},
	{
		sheet: SHEETS.paymentsRateCard,
		purpose:
			"Static reference: DMT commission slabs, AePS commissions and BBPS category rates.",
	},
	{
		sheet: SHEETS.bbpsOperators,
		purpose:
			"Static reference: operator-wise BBPS commission for 100+ billers.",
	},
];

/**
 * Build the "Index" sheet — the workbook's first tab: what's inside, how to
 * use it, and internal hyperlinks to every other sheet.
 */
export async function buildIndexSheet(
	ws: Worksheet,
	data: PricingXlsxData,
): Promise<void> {
	ws.columns = [{ width: 30 }, { width: 100 }];

	let row = 1;
	brandedTitle(
		ws,
		row,
		"B",
		"Eko Platform Services — API Pricing & Commission Calculator",
	);
	row++;

	const gstPct = Math.round(data.gstRate * 100);
	introRow(
		ws,
		row,
		"B",
		"Offline companion to the live pricing page. Covers verification APIs (a cost you pay per call), " +
			"DMT / AePS / BBPS (which pay YOU a commission per transaction) and Connected Banking.",
	);
	row++;
	introRow(
		ws,
		row,
		"B",
		`All amounts in INR, exclusive of GST @ ${gstPct}% unless stated. Editable cells are highlighted in light gold; everything else is locked (no password — Review → Unprotect Sheet to edit).`,
	);
	row++;

	const liveUrl = `${data.siteUrl}/pricing`;
	const link = fullWidthRow(ws, row, "B", {
		text: `Live calculator with shareable estimates: ${liveUrl}`,
		hyperlink: liveUrl,
	});
	link.font = { size: 10, underline: true, color: { argb: "FF0563C1" } };
	row++;

	row++; // spacer

	// -- TOC table -------------------------------------------------------------
	["Sheet", "What it's for"].forEach((header, i) => {
		const cell = ws.getCell(row, i + 1);
		cell.value = header;
		cell.font = { bold: true, size: 10 };
		cell.fill = solidFill(HEADER_FILL);
		cell.border = { bottom: { style: "thin", color: { argb: NAVY } } };
	});
	row++;

	for (const entry of TOC) {
		const nameCell = ws.getCell(`A${row}`);
		// exceljs internal-link form; sheet names with spaces must be quoted.
		nameCell.value = {
			text: entry.sheet,
			hyperlink: `#'${entry.sheet}'!A1`,
		};
		nameCell.font = { size: 11, underline: true, color: { argb: "FF0563C1" } };

		const purposeCell = ws.getCell(`B${row}`);
		purposeCell.value = entry.purpose;
		purposeCell.font = { size: 10, color: { argb: "FF475569" } };
		purposeCell.alignment = { wrapText: true, vertical: "top" };
		row++;
	}

	row++; // spacer

	for (const note of [
		"Commission figures are gross; TDS @ 2% is deducted from commission payouts.",
		"Commercials and pricing are subject to change based on service-provider terms; revisions are communicated in advance.",
		"For GST-compliant invoices, add your GST number on the Connect portal.",
	]) {
		footnoteRow(ws, row, "B", note);
		row++;
	}

	await protectSheet(ws);
}
