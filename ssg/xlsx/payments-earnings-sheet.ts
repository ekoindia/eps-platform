import type { Worksheet } from "exceljs";
import type { AmountSlab } from "../../src/lib/data/payments-pricing";
import {
	GOLD,
	INR_FORMAT,
	RATE_FORMAT,
	SHEETS,
	SUCCESS,
	brandedTitle,
	footnoteRow,
	fullWidthRow,
	groupBandRow,
	headerRow,
	introRow,
	markInputCell,
	protectSheet,
	solidFill,
	type PricingXlsxData,
} from "./shared";

/** Default avg txn amounts pre-filled in the input column */
const DMT_DEFAULT_AVG = 2500;
const AEPS_DEFAULT_AVG = 2000;

/**
 * Excel expression for the commission/txn of an amount-slab set, keyed on
 * the avg-amount cell. Single flat slab → numeric literal; single pct slab →
 * `ref*pct`; multiple slabs → nested IFs over the slab upper bounds.
 */
const slabFormula = (slabs: AmountSlab[], ref: string): string | number => {
	const valueExpr = (slab: AmountSlab): string =>
		slab.flat !== undefined ? String(slab.flat) : `${ref}*${slab.pct}`;

	if (slabs.length === 1) {
		const only = slabs[0];
		return only.flat !== undefined ? only.flat : `${ref}*${only.pct}`;
	}

	// Nested IFs: IF(ref<=cap1, v1, IF(ref<=cap2, v2, …, vLast))
	const capped = slabs.filter((slab) => slab.upTo !== null);
	const last = slabs[slabs.length - 1];
	let expr = valueExpr(last);
	for (let i = capped.length - 1; i >= 0; i--) {
		// Skip the last slab if it was capped — it's already the ELSE branch
		if (capped[i] === last) continue;
		expr = `IF(${ref}<=${capped[i].upTo},${valueExpr(capped[i])},${expr})`;
	}
	return expr;
};

/** One product row's config for the earnings table */
interface EarningsRowDef {
	name: string;
	basis: string;
	/** Default avg amount pre-filled in C; null = no amount input (locked) */
	defaultAvg: number | null;
	/** Min/max for the avg-amount validation */
	avgRange?: [number, number];
	/** Builds the E-column value: formula string or literal number */
	perTxn: (avgRef: string) => string | number;
	notes?: string;
}

/**
 * Build the interactive "Payments Earnings" sheet: DMT, AePS and BBPS
 * products with avg-amount + monthly-txn inputs and live commission
 * formulas, totalled with a TDS line.
 * @param dmtLookupRange - Absolute range of the DMT slab table on the
 *   Payments Rate Card sheet (columns From | Up to | Eko pricing | Commission)
 */
export async function buildPaymentsEarningsSheet(
	ws: Worksheet,
	data: PricingXlsxData,
	dmtLookupRange: string,
): Promise<void> {
	ws.columns = [
		{ width: 34 },
		{ width: 30 },
		{ width: 18 },
		{ width: 16 },
		{ width: 20 },
		{ width: 22 },
		{ width: 52 },
	];

	const { dmt, aeps, bbps } = data;
	const gstPct = Math.round(data.gstRate * 100);
	const tdsPct = Math.round(dmt.tdsRate * 100);

	let row = 1;
	brandedTitle(
		ws,
		row,
		"G",
		"Eko Platform Services — Payments & BC Earnings Calculator (DMT · AePS · BBPS)",
	);
	row++;

	introRow(
		ws,
		row,
		"G",
		`These products PAY YOU a commission per transaction. Enter your average transaction amount and expected monthly transactions in the highlighted columns. Commissions are in INR, exclusive of GST @ ${gstPct}%.`,
	);
	row++;

	const liveUrl = `${data.siteUrl}/pricing?tab=payments`;
	const link = fullWidthRow(ws, row, "G", {
		text: `Open the live earnings calculator: ${liveUrl}`,
		hyperlink: liveUrl,
	});
	link.font = { size: 10, underline: true, color: { argb: "FF0563C1" } };
	row++;

	row++; // spacer

	headerRow(ws, row, [
		"Product",
		"Commission basis",
		"Avg txn amount (₹)",
		"Monthly txns",
		"Commission / txn (₹)",
		"Monthly earnings (₹)",
		"Notes",
	]);
	row++;

	// -- Product groups -------------------------------------------------------
	const cashoutMax = aeps.cashoutSlabs[aeps.cashoutSlabs.length - 1].upTo ?? 0;
	const groups: { label: string; rows: EarningsRowDef[] }[] = [
		{
			label: "DMT — Domestic Money Transfer",
			rows: [
				{
					name: "Domestic Money Transfer (DMT)",
					basis: "Slab by txn amount — see Payments Rate Card",
					defaultAvg: DMT_DEFAULT_AVG,
					avgRange: [dmt.slabs[0].from, dmt.maxTxnAmount],
					perTxn: (avgRef) =>
						`IF(${avgRef}="","",VLOOKUP(${avgRef},${dmtLookupRange},4,TRUE))`,
					notes: `Sender pays ${dmt.customerFeePct * 100}% fee (min ₹${dmt.customerFeeMin}); one-time sender KYC ₹${dmt.senderKycFee}`,
				},
			],
		},
		{
			label: "AePS — Aadhaar-Enabled Payment System",
			rows: [
				{
					name: "AePS Cash Withdrawal",
					basis: aeps.cashoutSlabs
						.map((slab) =>
							slab.flat !== undefined
								? `₹${slab.flat} flat above ₹${(slab.from - 1).toLocaleString("en-IN")}`
								: `${(slab.pct ?? 0) * 100}% up to ₹${(slab.upTo ?? 0).toLocaleString("en-IN")}`,
						)
						.join("; "),
					defaultAvg: AEPS_DEFAULT_AVG,
					avgRange: [aeps.cashoutSlabs[0].from, cashoutMax],
					perTxn: (avgRef) =>
						`IF(${avgRef}="","",${slabFormula(aeps.cashoutSlabs, avgRef)})`,
				},
				{
					name: "AePS Mini Statement",
					basis: `₹${aeps.miniStatementCommission.toFixed(2)} flat`,
					defaultAvg: null,
					perTxn: () => aeps.miniStatementCommission,
				},
			],
		},
		{
			label: "BBPS — Bill Payments (category-level)",
			rows: bbps.categories.map((category) => ({
				name: category.name,
				basis: category.slabs.length > 1 ? "Slab by txn amount" : "Flat",
				defaultAvg: category.defaultAvgAmount,
				avgRange: [1, 200000] as [number, number],
				perTxn: (avgRef: string) => {
					const expr = slabFormula(category.slabs, avgRef);
					return typeof expr === "number"
						? expr
						: `IF(${avgRef}="","",${expr})`;
				},
				notes: category.rangeNote,
			})),
		},
	];

	let firstDataRow = 0;
	let lastDataRow = 0;
	for (const group of groups) {
		groupBandRow(ws, row, "G", group.label);
		row++;

		for (const def of group.rows) {
			if (!firstDataRow) firstDataRow = row;
			lastDataRow = row;

			ws.getCell(`A${row}`).value = def.name;
			const basisCell = ws.getCell(`B${row}`);
			basisCell.value = def.basis;
			basisCell.font = { size: 9, color: { argb: "FF64748B" } };

			if (def.defaultAvg !== null) {
				const avgCell = markInputCell(ws, `C${row}`);
				avgCell.value = def.defaultAvg;
				avgCell.numFmt = "#,##0";
				if (def.avgRange) {
					avgCell.dataValidation = {
						type: "whole",
						operator: "between",
						allowBlank: true,
						showErrorMessage: true,
						formulae: def.avgRange,
						errorTitle: "Invalid amount",
						error: `Enter an amount between ₹${def.avgRange[0].toLocaleString("en-IN")} and ₹${def.avgRange[1].toLocaleString("en-IN")}.`,
					};
				}
			}

			const txnsCell = markInputCell(ws, `D${row}`);
			txnsCell.numFmt = "#,##0";
			txnsCell.dataValidation = {
				type: "whole",
				operator: "between",
				allowBlank: true,
				showErrorMessage: true,
				formulae: [0, data.maxVolume],
				errorTitle: "Invalid count",
				error: `Enter a whole number between 0 and ${data.maxVolume.toLocaleString("en-IN")}.`,
			};

			const perTxnCell = ws.getCell(`E${row}`);
			const perTxnValue = def.perTxn(`C${row}`);
			perTxnCell.value =
				typeof perTxnValue === "number"
					? perTxnValue
					: { formula: perTxnValue };
			perTxnCell.numFmt = RATE_FORMAT;

			const earningsCell = ws.getCell(`F${row}`);
			earningsCell.value = { formula: `IFERROR(N(E${row})*N(D${row}),0)` };
			earningsCell.numFmt = INR_FORMAT;
			earningsCell.font = { color: { argb: SUCCESS } };

			if (def.notes) {
				const notesCell = ws.getCell(`G${row}`);
				notesCell.value = def.notes;
				notesCell.font = { size: 9, color: { argb: "FF64748B" } };
			}

			row++;
		}
	}

	row++; // spacer

	// -- Summary block ----------------------------------------------------------
	const summaryRow = (
		label: string,
		formula: string,
		opts?: { gold?: boolean },
	) => {
		ws.mergeCells(`A${row}:E${row}`);
		const labelCell = ws.getCell(`A${row}`);
		labelCell.value = label;
		labelCell.alignment = { horizontal: "right" };
		labelCell.font = { bold: true, size: opts?.gold ? 12 : 10 };
		const valueCell = ws.getCell(`F${row}`);
		valueCell.value = { formula };
		valueCell.numFmt = INR_FORMAT;
		valueCell.font = { bold: true, size: opts?.gold ? 12 : 10 };
		if (opts?.gold) {
			labelCell.fill = solidFill(GOLD);
			valueCell.fill = solidFill(GOLD);
		}
		const r = row;
		row++;
		return r;
	};

	const grossRow = summaryRow(
		"Gross monthly commission (excl. GST)",
		`SUM(F${firstDataRow}:F${lastDataRow})`,
	);
	const tdsRow = summaryRow(
		`Less TDS @ ${tdsPct}%`,
		`F${grossRow}*${dmt.tdsRate}`,
	);
	summaryRow("Indicative net monthly payout", `F${grossRow}-F${tdsRow}`, {
		gold: true,
	});

	row++; // spacer

	// -- Footnotes ----------------------------------------------------------------
	const footnotes = [
		"Estimates use your AVERAGE transaction amount; actual earnings depend on each transaction's slab.",
		`DMT: sender pays a ${dmt.customerFeePct * 100}% transaction fee (min ₹${dmt.customerFeeMin}) and a one-time ₹${dmt.senderKycFee} KYC charge.`,
		`AePS fund settlements carry a charge of ${aeps.settlementCharges.map((slab) => `₹${slab.flat} (${slab.upTo === null ? `above ₹${(slab.from - 1).toLocaleString("en-IN")}` : `up to ₹${slab.upTo.toLocaleString("en-IN")}`})`).join(" / ")} + GST.`,
		"Where BBPS operator rates vary, the LOWEST rate is used for a conservative estimate.",
	];
	for (const note of footnotes) {
		footnoteRow(ws, row, "G", note);
		row++;
	}

	// Internal link to the full BBPS operator list
	const opsLink = fullWidthRow(ws, row, "G", {
		text: `Operator-wise BBPS rates (${bbps.operators.length} billers) → see the "${SHEETS.bbpsOperators}" sheet`,
		hyperlink: `#'${SHEETS.bbpsOperators}'!A1`,
	});
	opsLink.font = { size: 9, underline: true, color: { argb: "FF0563C1" } };
	row++;

	await protectSheet(ws);
}
