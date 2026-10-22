import type { Worksheet } from "exceljs";
import {
	GOLD,
	INR_FORMAT,
	RATE_FORMAT,
	brandedTitle,
	footnoteRow,
	fullWidthRow,
	groupBandRow,
	introRow,
	markInputCell,
	protectSheet,
	setupFeeLabel,
	solidFill,
	type PricingXlsxData,
} from "./shared";

/**
 * Build the interactive "Credit Card Bills" sheet: a monthly payment count
 * input with flat-fee + GST formulas and the one-time setup fee — matching
 * calcCcQuote on the web (discounted setup fee, zero at zero payments).
 */
export async function buildCreditCardSheet(
	ws: Worksheet,
	data: PricingXlsxData,
): Promise<void> {
	ws.columns = [{ width: 46 }, { width: 20 }, { width: 64 }];

	const { cc } = data;
	const gstPct = Math.round(data.gstRate * 100);

	let row = 1;
	brandedTitle(
		ws,
		row,
		"C",
		"Eko Platform Services — Credit Card Bill Payment Cost Calculator",
	);
	row++;

	introRow(
		ws,
		row,
		"C",
		`Credit card bill payments are CHARGED a flat fee per payment (unlike other BBPS bills, which earn a commission). Enter your monthly payments in the highlighted cell. All amounts in INR, exclusive of GST @ ${gstPct}% unless stated.`,
	);
	row++;

	const liveUrl = `${data.siteUrl}/pricing?tab=credit-card`;
	const link = fullWidthRow(ws, row, "C", {
		text: `Open the live calculator: ${liveUrl}`,
		hyperlink: liveUrl,
	});
	link.font = { size: 10, underline: true, color: { argb: "FF0563C1" } };
	row++;

	row++; // spacer

	groupBandRow(ws, row, "C", "Your inputs");
	row++;
	ws.getCell(`A${row}`).value = "Monthly credit card bill payments";
	const input = markInputCell(ws, `B${row}`);
	input.value = cc.defaultMonthlyTxns;
	input.numFmt = "#,##0";
	input.dataValidation = {
		type: "whole",
		operator: "between",
		allowBlank: false,
		showErrorMessage: true,
		formulae: [0, data.maxVolume],
		errorTitle: "Invalid value",
		error: `Enter a whole number between 0 and ${data.maxVolume.toLocaleString("en-IN")}.`,
	};
	const txnsRow = row;
	row++;

	row++; // spacer

	const valueRow = (
		label: string,
		formula: string,
		opts?: { gold?: boolean; numFmt?: string },
	): number => {
		ws.getCell(`A${row}`).value = label;
		ws.getCell(`A${row}`).font = { bold: true, size: opts?.gold ? 12 : 10 };
		const cell = ws.getCell(`B${row}`);
		cell.value = { formula };
		cell.numFmt = opts?.numFmt ?? INR_FORMAT;
		cell.font = { bold: true, size: opts?.gold ? 12 : 10 };
		if (opts?.gold) {
			ws.getCell(`A${row}`).fill = solidFill(GOLD);
			cell.fill = solidFill(GOLD);
		}
		const r = row;
		row++;
		return r;
	};

	groupBandRow(ws, row, "C", "Monthly fees");
	row++;
	const perTxnRow = valueRow("Fee per payment", String(cc.feePerTxn), {
		numFmt: RATE_FORMAT,
	});
	const monthlyRow = valueRow(
		"Monthly fees (excl. GST)",
		`B${txnsRow}*B${perTxnRow}`,
	);
	const monthlyGstRow = valueRow(
		`GST @ ${gstPct}%`,
		`B${monthlyRow}*${data.gstRate}`,
	);
	valueRow(
		"Estimated monthly total (incl. GST)",
		`B${monthlyRow}+B${monthlyGstRow}`,
		{ gold: true },
	);

	row++; // spacer

	groupBandRow(ws, row, "C", "One-time setup");
	row++;
	const netFactor = (100 - data.setupFeeDiscountPercent) / 100;
	valueRow(
		`${setupFeeLabel(data.setupFeeDiscountPercent)}, excl. GST`,
		`IF(B${txnsRow}>0,${cc.setupFee},0)*${netFactor}`,
	);

	row++; // spacer

	footnoteRow(
		ws,
		row,
		"C",
		`Flat ₹${cc.feePerTxn} + GST per payment, whatever the bill amount. One-time setup fee: ₹${cc.setupFee.toLocaleString("en-IN")} + GST, separate from the BBPS setup fee.`,
	);
	row++;
	footnoteRow(
		ws,
		row,
		"C",
		"Commercials are subject to change based on service-provider terms; revisions are communicated in advance.",
	);

	await protectSheet(ws);
}
