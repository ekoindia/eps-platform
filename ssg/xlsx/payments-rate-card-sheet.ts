import type { Worksheet } from "exceljs";
import {
	RATE_FORMAT,
	SHEETS,
	brandedTitle,
	footnoteRow,
	groupBandRow,
	headerRow,
	introRow,
	protectSheet,
	slabRangeText,
	slabValueText,
	solidFill,
	HEADER_FILL,
	NAVY,
	type PricingXlsxData,
} from "./shared";

/**
 * Build the static "Payments Rate Card" sheet (DMT slabs, AePS, BBPS
 * categories). The DMT slab table doubles as the VLOOKUP source for the
 * Payments Earnings sheet — its first column is the ascending slab lower
 * bound. Returns the absolute range reference of that table (columns A–D:
 * From | Up to | Eko pricing | Commission).
 */
export async function buildPaymentsRateCardSheet(
	ws: Worksheet,
	data: PricingXlsxData,
): Promise<{ dmtLookupRange: string }> {
	ws.columns = [
		{ width: 18 },
		{ width: 18 },
		{ width: 20 },
		{ width: 24 },
		{ width: 22 },
		{ width: 52 },
	];

	const { dmt, aeps, bbps } = data;
	const tdsPct = Math.round(dmt.tdsRate * 100);

	let row = 1;
	brandedTitle(
		ws,
		row,
		"F",
		"Eko Platform Services — Payments & BC Commission Rate Card",
	);
	row++;

	const gstPct = Math.round(data.gstRate * 100);
	introRow(
		ws,
		row,
		"F",
		`DMT, AePS and BBPS pay YOU a commission per transaction. All values in INR, exclusive of GST @ ${gstPct}%. TDS @ ${tdsPct}% applies on payouts.`,
	);
	row++;

	row++; // spacer

	// -- DMT slab table (VLOOKUP source) ------------------------------------
	groupBandRow(ws, row, "F", "DMT — Commission by transaction amount");
	row++;

	// Sub-header (not frozen — header freeze is reserved for long tables)
	[
		"From (₹)",
		"Up to (₹)",
		"Eko pricing (₹)",
		"Your commission (₹)",
		`After TDS @ ${tdsPct}% (₹)`,
		"",
	].forEach((header, i) => {
		const cell = ws.getCell(row, i + 1);
		cell.value = header;
		cell.font = { bold: true, size: 10 };
		cell.fill = solidFill(HEADER_FILL);
		cell.border = { bottom: { style: "thin", color: { argb: NAVY } } };
	});
	row++;

	const dmtFirstRow = row;
	for (const slab of dmt.slabs) {
		ws.getCell(`A${row}`).value = slab.from;
		ws.getCell(`A${row}`).numFmt = "#,##0";
		ws.getCell(`B${row}`).value = slab.upTo;
		ws.getCell(`B${row}`).numFmt = "#,##0";
		const eko = ws.getCell(`C${row}`);
		eko.value = slab.ekoPricing;
		eko.numFmt = RATE_FORMAT;
		const commission = ws.getCell(`D${row}`);
		commission.value = slab.commission;
		commission.numFmt = RATE_FORMAT;
		const afterTds = ws.getCell(`E${row}`);
		afterTds.value =
			Math.round(slab.commission * (1 - dmt.tdsRate) * 100) / 100;
		afterTds.numFmt = RATE_FORMAT;
		row++;
	}
	const dmtLastRow = row - 1;

	footnoteRow(
		ws,
		row,
		"F",
		`Sender transaction fee: ${dmt.customerFeePct * 100}% of the amount, minimum ₹${dmt.customerFeeMin} — paid by the sender. One-time sender KYC: ₹${dmt.senderKycFee} (excl. GST). Maximum transaction amount: ₹${dmt.maxTxnAmount.toLocaleString("en-IN")}.`,
	);
	row++;

	row++; // spacer

	// -- AePS ---------------------------------------------------------------
	groupBandRow(ws, row, "F", "AePS — Cashout, mini statement & settlement");
	row++;

	for (const slab of aeps.cashoutSlabs) {
		ws.getCell(`A${row}`).value = `Cashout · ${slabRangeText(slab)}`;
		ws.mergeCells(`A${row}:B${row}`);
		ws.getCell(`C${row}`).value =
			slab.flat !== undefined
				? `₹${slab.flat.toFixed(2)} flat`
				: slabValueText(slab);
		row++;
	}
	ws.getCell(`A${row}`).value = "Mini statement";
	ws.mergeCells(`A${row}:B${row}`);
	ws.getCell(`C${row}`).value =
		`₹${aeps.miniStatementCommission.toFixed(2)} per transaction`;
	row++;
	for (const slab of aeps.settlementCharges) {
		ws.getCell(`A${row}`).value = `Fund settlement · ${slabRangeText(slab)}`;
		ws.mergeCells(`A${row}:B${row}`);
		ws.getCell(`C${row}`).value = `${slabValueText(slab)} + GST (charge)`;
		row++;
	}

	row++; // spacer

	// -- BBPS categories ------------------------------------------------------
	groupBandRow(ws, row, "F", "BBPS — Commission by bill category");
	row++;

	["Category", "", "Commission (excl. GST)", "", "", "Notes"].forEach(
		(header, i) => {
			if (!header) return;
			const cell = ws.getCell(row, i + 1);
			cell.value = header;
			cell.font = { bold: true, size: 10 };
			cell.fill = solidFill(HEADER_FILL);
			cell.border = { bottom: { style: "thin", color: { argb: NAVY } } };
		},
	);
	row++;

	for (const category of bbps.categories) {
		ws.getCell(`A${row}`).value = category.name;
		ws.mergeCells(`A${row}:B${row}`);
		ws.getCell(`C${row}`).value = category.slabs
			.map((slab) =>
				category.slabs.length > 1
					? `${slabRangeText(slab)}: ${slabValueText(slab)}`
					: slabValueText(slab),
			)
			.join("; ");
		ws.mergeCells(`C${row}:E${row}`);
		const notes = ws.getCell(`F${row}`);
		notes.value = category.rangeNote ?? "";
		notes.font = { size: 9, color: { argb: "FF64748B" } };
		row++;
	}

	footnoteRow(
		ws,
		row,
		"F",
		`Where operator rates vary, the lowest rate is shown (conservative). Operator-wise rates: see the "${SHEETS.bbpsOperators}" sheet.`,
	);
	row++;

	await protectSheet(ws);

	return {
		dmtLookupRange: `'${SHEETS.paymentsRateCard}'!$A$${dmtFirstRow}:$D$${dmtLastRow}`,
	};
}
