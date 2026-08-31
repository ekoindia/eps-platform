import type { Worksheet } from "exceljs";
import {
	GOLD,
	HEADER_FILL,
	INR_FORMAT,
	NAVY,
	RATE_FORMAT,
	SUCCESS,
	brandedTitle,
	footnoteRow,
	fullWidthRow,
	groupBandRow,
	introRow,
	markInputCell,
	protectSheet,
	solidFill,
	type PricingXlsxData,
} from "./shared";

/**
 * Build the interactive "DMT Calculator" sheet.
 *
 * DMT commission is closed-form, so every figure here is a LIVE Excel formula
 * rather than a VLOOKUP against a slab table. The rounding points mirror
 * `calcDmtTxn` in `src/lib/data/dmt-pricing.ts` exactly — ROUND after the
 * ÷(1+GST) and on TDS — so the workbook and the website never disagree.
 */
export async function buildDmtSheet(
	ws: Worksheet,
	data: PricingXlsxData,
): Promise<void> {
	ws.columns = [{ width: 46 }, { width: 20 }, { width: 66 }];

	const { dmt } = data;
	const gstPct = Math.round(data.gstRate * 100);
	const tdsPct = Math.round(data.tdsRate * 100);

	let row = 1;
	brandedTitle(ws, row, "C", "Eko Platform Services — DMT Earnings Calculator");
	row++;

	introRow(
		ws,
		row,
		"C",
		`Domestic Money Transfer. The sender's fee is INCLUSIVE of GST @ ${gstPct}% — GST is never added on top. Enter your inputs in the highlighted cells.`,
	);
	row++;

	const liveUrl = `${data.siteUrl}/pricing?tab=dmt`;
	const link = fullWidthRow(ws, row, "C", {
		text: `Open the live calculator: ${liveUrl}`,
		hyperlink: liveUrl,
	});
	link.font = { size: 10, underline: true, color: { argb: "FF0563C1" } };
	row++;

	row++; // spacer

	// -- Inputs ---------------------------------------------------------------
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

	const amountRow = inputRow(
		"Average transfer amount (₹)",
		dmt.defaultAmount,
		[dmt.minTxnAmount, dmt.maxTxnAmount],
		`Maximum ₹${dmt.maxTxnAmount.toLocaleString("en-IN")} per transaction`,
	);
	const txnsRow = inputRow("Transfers per month", dmt.defaultMonthlyTxns, [
		0,
		data.maxVolume,
	]);
	const sendersRow = inputRow(
		"New senders registered / month",
		50,
		[0, data.maxVolume],
		`KYC ₹${dmt.senderKycFee} + GST = ₹${dmt.senderKycInclGst.toFixed(2)} each`,
	);
	const recipientsRow = inputRow(
		"New recipients added / month",
		80,
		[0, data.maxVolume],
		`Account verification ₹${dmt.recipientVerifyFee.toFixed(2)} each (incl. GST)`,
	);

	// Yes/No toggle — recovery is a reimbursement, not a suppressed cost.
	ws.getCell(`A${row}`).value = "Recover KYC & verification from customer?";
	const recoverCell = markInputCell(ws, `B${row}`);
	recoverCell.value = "No";
	recoverCell.dataValidation = {
		type: "list",
		allowBlank: false,
		showErrorMessage: true,
		formulae: ['"Yes,No"'],
		errorTitle: "Invalid value",
		error: "Choose Yes or No.",
	};
	const recoverNote = ws.getCell(`C${row}`);
	recoverNote.value =
		"The wallet is debited either way; Yes adds an offsetting reimbursement.";
	recoverNote.font = { size: 9, color: { argb: "FF64748B" } };
	const recoverRow = row;
	row++;

	row++; // spacer

	const valueRow = (
		label: string,
		formula: string,
		opts?: { gold?: boolean; numFmt?: string; note?: string },
	): number => {
		const labelCell = ws.getCell(`A${row}`);
		labelCell.value = label;
		labelCell.font = { bold: Boolean(opts?.gold), size: opts?.gold ? 12 : 10 };
		const cell = ws.getCell(`B${row}`);
		cell.value = { formula, date1904: false };
		cell.numFmt = opts?.numFmt ?? RATE_FORMAT;
		cell.font = {
			bold: true,
			size: opts?.gold ? 12 : 10,
			color: { argb: opts?.gold ? SUCCESS : NAVY },
		};
		if (opts?.gold) cell.fill = solidFill(GOLD);
		if (opts?.note) {
			const noteCell = ws.getCell(`C${row}`);
			noteCell.value = opts.note;
			noteCell.font = { size: 9, color: { argb: "FF64748B" } };
		}
		const r = row;
		row++;
		return r;
	};

	// -- Per-transaction ledger ------------------------------------------------
	groupBandRow(ws, row, "C", "Per transaction");
	row++;

	const feeRow = valueRow(
		`Sender's transaction fee (${dmt.customerFeePct * 100}%, min ₹${dmt.customerFeeMin})`,
		`ROUND(MAX(${dmt.customerFeeMin},B${amountRow}*${dmt.customerFeePct}),2)`,
		{ note: `Inclusive of GST @ ${gstPct}% — nothing is added on top` },
	);
	const taxableRow = valueRow(
		"Taxable value (fee excl. GST)",
		`ROUND(B${feeRow}/(1+${data.gstRate}),2)`,
	);
	valueRow(`GST inside the fee (${gstPct}%)`, `B${feeRow}-B${taxableRow}`, {
		note: "Paid to the government by Eko, not collected by you",
	});
	const ekoRow = valueRow("Less: Eko charges", `-${dmt.ekoCharge}`);
	const grossRow = valueRow(
		"Gross partner commission",
		`B${taxableRow}+B${ekoRow}`,
	);
	valueRow(
		`Of which GST under RCM (${gstPct}%)`,
		`ROUND(B${grossRow}*${data.gstRate},2)`,
		{ note: 'Eko pays this. Invoice Eko with RCM = "YES" and no GST line.' },
	);
	const tdsRow = valueRow(
		`Less: TDS @ ${tdsPct}%`,
		`-ROUND(B${grossRow}*${data.tdsRate},2)`,
	);
	valueRow("Net partner commission", `B${grossRow}+B${tdsRow}`);

	row++; // spacer

	// -- Monthly ---------------------------------------------------------------
	groupBandRow(ws, row, "C", "Per month");
	row++;

	const monthlyGrossRow = valueRow(
		"Gross commission",
		`B${grossRow}*B${txnsRow}`,
		{ numFmt: INR_FORMAT },
	);
	// TDS is withheld on the monthly aggregate, NOT per transaction.
	const monthlyTdsRow = valueRow(
		`Less: TDS @ ${tdsPct}%`,
		`-ROUND(B${monthlyGrossRow}*${data.tdsRate},2)`,
		{
			numFmt: INR_FORMAT,
			note: "Withheld on the monthly total, not per transaction",
		},
	);
	const monthlyNetRow = valueRow(
		"Net commission",
		`B${monthlyGrossRow}+B${monthlyTdsRow}`,
		{ numFmt: INR_FORMAT },
	);
	const kycRow = valueRow(
		"Less: sender KYC charges",
		`-B${sendersRow}*${dmt.senderKycInclGst}`,
		{ numFmt: INR_FORMAT },
	);
	const verifyRow = valueRow(
		"Less: recipient account verification",
		`-B${recipientsRow}*${dmt.recipientVerifyFee}`,
		{ numFmt: INR_FORMAT },
	);
	const recoveredRow = valueRow(
		"Add: recovered from customers",
		`IF(B${recoverRow}="Yes",-(B${kycRow}+B${verifyRow}),0)`,
		{ numFmt: INR_FORMAT },
	);
	valueRow(
		"YOUR MONTHLY TAKE-HOME",
		`B${monthlyNetRow}+B${kycRow}+B${verifyRow}+B${recoveredRow}`,
		{ gold: true, numFmt: INR_FORMAT },
	);

	row++; // spacer

	footnoteRow(
		ws,
		row,
		"C",
		`One-time setup fee: ₹${data.bcSetupFee.toLocaleString("en-IN")} for the DMT API family (excl. GST), charged once — not included in the monthly figures above.`,
	);
	row++;

	row++; // spacer

	// -- Static rate card ------------------------------------------------------
	groupBandRow(ws, row, "C", "Commission at representative transfer amounts");
	row++;

	[
		"Transfer amount (₹)",
		"Sender fee (₹)",
		"Taxable value (₹)",
		"Eko charge (₹)",
		"Your commission (₹)",
		`After TDS @ ${tdsPct}% (₹)`,
	].forEach((header, i) => {
		const cell = ws.getCell(row, i + 1);
		cell.value = header;
		cell.font = { bold: true, size: 10 };
		cell.fill = solidFill(HEADER_FILL);
		cell.border = { bottom: { style: "thin", color: { argb: NAVY } } };
	});
	row++;

	for (const entry of dmt.rows) {
		ws.getCell(`A${row}`).value = entry.amount;
		ws.getCell(`A${row}`).numFmt = "#,##0";
		const cells: [string, number][] = [
			["B", entry.customerFee],
			["C", entry.feeExGst],
			["D", entry.ekoCharge],
			["E", entry.grossCommission],
			["F", entry.netCommission],
		];
		for (const [col, value] of cells) {
			const cell = ws.getCell(`${col}${row}`);
			cell.value = value;
			cell.numFmt = RATE_FORMAT;
		}
		row++;
	}

	footnoteRow(
		ws,
		row,
		"F",
		`Commission scales continuously with the transfer amount — these are representative amounts, not bands. Below ₹1,000 the fee floors at ₹${dmt.customerFeeMin}. Reverse Charge Mechanism applies: Eko pays the GST on your commission; raise your invoice with RCM = "YES". Confirm the treatment for your registration with your accountant.`,
	);

	protectSheet(ws);
}
