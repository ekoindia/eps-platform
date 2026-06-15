import type { Worksheet } from "exceljs";
import {
	GOLD,
	INR_FORMAT,
	RATE_FORMAT,
	brandedTitle,
	footnoteRow,
	fullWidthRow,
	groupBandRow,
	headerRow,
	introRow,
	markInputCell,
	protectSheet,
	slabRangeText,
	solidFill,
	type PricingXlsxData,
} from "./shared";

/**
 * Build the interactive "Connected Banking" sheet: bank-integration count,
 * monthly txns and avg amount inputs with one-time setup and monthly charge
 * formulas (each with GST broken out), plus the static bank/slab rate card.
 */
export async function buildConnectedBankingSheet(
	ws: Worksheet,
	data: PricingXlsxData,
): Promise<void> {
	ws.columns = [{ width: 46 }, { width: 20 }, { width: 64 }];

	const { cb } = data;
	const gstPct = Math.round(data.gstRate * 100);

	let row = 1;
	brandedTitle(
		ws,
		row,
		"C",
		"Eko Platform Services — Connected Banking Cost Calculator",
	);
	row++;

	introRow(
		ws,
		row,
		"C",
		`Virtual accounts & BaaS infrastructure. Enter your inputs in the highlighted cells. All amounts in INR, exclusive of GST @ ${gstPct}% unless stated.`,
	);
	row++;

	const liveUrl = `${data.siteUrl}/pricing?tab=banking`;
	const link = fullWidthRow(ws, row, "C", {
		text: `Open the live calculator: ${liveUrl}`,
		hyperlink: liveUrl,
	});
	link.font = { size: 10, underline: true, color: { argb: "FF0563C1" } };
	row++;

	row++; // spacer

	// -- Inputs -----------------------------------------------------------------
	groupBandRow(ws, row, "C", "Your inputs");
	row++;

	const inputRow = (
		label: string,
		defaultValue: number,
		range: [number, number],
		note?: string,
	): number => {
		ws.getCell(`A${row}`).value = label;
		const cell = markInputCell(ws, `B${row}`);
		cell.value = defaultValue;
		cell.numFmt = "#,##0";
		cell.dataValidation = {
			type: "whole",
			operator: "between",
			allowBlank: false,
			showErrorMessage: true,
			formulae: range,
			errorTitle: "Invalid value",
			error: `Enter a whole number between ${range[0].toLocaleString("en-IN")} and ${range[1].toLocaleString("en-IN")}.`,
		};
		if (note) {
			const noteCell = ws.getCell(`C${row}`);
			noteCell.value = note;
			noteCell.font = { size: 9, color: { argb: "FF64748B" } };
		}
		const r = row;
		row++;
		return r;
	};

	const banksRow = inputRow(
		"Bank integrations (bank × user)",
		1,
		[1, cb.maxBankUsers],
		`Available banks: ${cb.banks.join(" | ")}`,
	);
	const txnsRow = inputRow("Monthly transactions", 5000, [0, data.maxVolume]);
	const lastSlab = cb.txnSlabs[cb.txnSlabs.length - 1];
	const amountRow = inputRow(
		"Average transaction amount (₹)",
		10000,
		[cb.txnSlabs[0].from, lastSlab.upTo ?? cb.txnSlabs[0].from],
		"Determines the per-transaction charge slab",
	);

	row++; // spacer

	// -- Computed blocks ----------------------------------------------------------
	const valueRow = (
		label: string,
		formula: string,
		opts?: { gold?: boolean; numFmt?: string },
	): number => {
		ws.getCell(`A${row}`).value = label;
		ws.getCell(`A${row}`).font = {
			bold: true,
			size: opts?.gold ? 12 : 10,
		};
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

	groupBandRow(ws, row, "C", "One-time setup");
	row++;
	const setupRow = valueRow(
		`Setup fee (₹${cb.setupFee.toLocaleString("en-IN")} × bank integrations)`,
		`${cb.setupFee}*B${banksRow}`,
	);
	const setupGstRow = valueRow(
		`GST @ ${gstPct}%`,
		`B${setupRow}*${data.gstRate}`,
	);
	valueRow("Setup total (incl. GST)", `B${setupRow}+B${setupGstRow}`, {
		gold: true,
	});

	row++; // spacer

	groupBandRow(ws, row, "C", "Monthly transaction charges");
	row++;
	// Per-txn charge: nested IFs over the charge slabs (flat amounts)
	const capped = cb.txnSlabs.filter((slab) => slab.upTo !== null);
	let chargeExpr = String(lastSlab.flat ?? 0);
	for (let i = capped.length - 1; i >= 0; i--) {
		if (capped[i] === lastSlab) continue;
		chargeExpr = `IF(B${amountRow}<=${capped[i].upTo},${capped[i].flat},${chargeExpr})`;
	}
	const perTxnRow = valueRow("Per-transaction charge", chargeExpr, {
		numFmt: RATE_FORMAT,
	});
	const monthlyRow = valueRow(
		"Monthly charges (excl. GST)",
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

	// -- Static rate card --------------------------------------------------------
	groupBandRow(ws, row, "C", "Rate card");
	row++;
	headerRow(ws, row, ["Transaction slab (INR)", "Charge per txn (excl. GST)"]);
	// Undo the freeze — headerRow freezes panes, unwanted mid-sheet here.
	ws.views = [{ state: "normal" }];
	row++;
	for (const slab of cb.txnSlabs) {
		ws.getCell(`A${row}`).value = slabRangeText(slab);
		const charge = ws.getCell(`B${row}`);
		charge.value = slab.flat ?? 0;
		charge.numFmt = RATE_FORMAT;
		row++;
	}

	footnoteRow(
		ws,
		row,
		"C",
		`One-time setup fee: ₹${cb.setupFee.toLocaleString("en-IN")} + GST per bank per user · Available banks: ${cb.banks.join(" | ")}.`,
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
