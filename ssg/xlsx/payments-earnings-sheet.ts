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
	setupFeeLabel,
	solidFill,
	type PricingXlsxData,
} from "./shared";

/** Default avg txn amounts pre-filled in the input column */
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
	/** Builds the commission/txn value: formula string or literal number */
	perTxn: (avgRef: string, modeRef: string) => string | number;
	/** BBPS only — offer the offline settlement mode in a dropdown */
	offlineAvailable?: boolean;
	notes?: string;
}

/** Settlement-mode dropdown labels (BBPS rows) */
const MODE_INSTANT = "Instant";
const modeOfflineLabel = (hours: number) => `${hours}-hour (higher)`;

/**
 * Build the interactive "Payments Earnings" sheet: AePS and BBPS products
 * with avg-amount + monthly-txn inputs and live commission formulas,
 * totalled with a TDS line. DMT has its own sheet — see `dmt-sheet.ts`.
 */
export async function buildPaymentsEarningsSheet(
	ws: Worksheet,
	data: PricingXlsxData,
): Promise<void> {
	ws.columns = [
		{ width: 34 },
		{ width: 30 },
		{ width: 18 },
		{ width: 18 },
		{ width: 16 },
		{ width: 20 },
		{ width: 22 },
		{ width: 52 },
	];

	const { aeps, bbps } = data;
	const offlineLabel = modeOfflineLabel(bbps.offlineSettlementHours);
	const gstPct = Math.round(data.gstRate * 100);
	const tdsPct = Math.round(data.tdsRate * 100);

	let row = 1;
	brandedTitle(
		ws,
		row,
		"H",
		"Eko Platform Services — Payments & BC Earnings Calculator (DMT · AePS · BBPS)",
	);
	row++;

	introRow(
		ws,
		row,
		"H",
		`These products PAY YOU a commission per transaction. Enter your average transaction amount and expected monthly transactions in the highlighted columns. Commissions are in INR, exclusive of GST @ ${gstPct}%.`,
	);
	row++;

	const liveUrl = `${data.siteUrl}/pricing?tab=payments`;
	const link = fullWidthRow(ws, row, "H", {
		text: `Open the live earnings calculator: ${liveUrl}`,
		hyperlink: liveUrl,
	});
	link.font = { size: 10, underline: true, color: { argb: "FF0563C1" } };
	row++;

	row++; // spacer

	headerRow(ws, row, [
		"Product",
		"Commission basis",
		"Settlement mode",
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
					perTxn: (avgRef: string) =>
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
				basis:
					category.online.length > 1 || (category.offline?.length ?? 0) > 1
						? "Slab by txn amount"
						: "Flat",
				defaultAvg: category.defaultAvgAmount,
				avgRange: [1, 500000] as [number, number],
				offlineAvailable: category.offline !== null,
				perTxn: (avgRef: string, modeRef: string) => {
					const online = slabFormula(category.online, avgRef);
					if (!category.offline) {
						return typeof online === "number"
							? online
							: `IF(${avgRef}="","",${online})`;
					}
					const offline = slabFormula(category.offline, avgRef);
					return `IF(${avgRef}="","",IF(${modeRef}="${offlineLabel}",${offline},${online}))`;
				},
				notes: [category.rangeNote, category.offlineNote]
					.filter(Boolean)
					.join(" · "),
			})),
		},
	];

	let firstDataRow = 0;
	let lastDataRow = 0;
	// Row span per API family — the setup fee is charged once per family, so
	// the one-time row needs each block's range, not just the overall extent.
	const familyRanges: { first: number; last: number }[] = [];
	for (const group of groups) {
		groupBandRow(ws, row, "H", group.label);
		row++;

		const familyFirstRow = row;
		for (const def of group.rows) {
			if (!firstDataRow) firstDataRow = row;
			lastDataRow = row;

			ws.getCell(`A${row}`).value = def.name;
			const basisCell = ws.getCell(`B${row}`);
			basisCell.value = def.basis;
			basisCell.font = { size: 9, color: { argb: "FF64748B" } };

			const modeCell = ws.getCell(`C${row}`);
			if (def.offlineAvailable) {
				markInputCell(ws, `C${row}`);
				modeCell.value = MODE_INSTANT;
				modeCell.dataValidation = {
					type: "list",
					allowBlank: false,
					showErrorMessage: true,
					formulae: [`"${MODE_INSTANT},${offlineLabel}"`],
					errorTitle: "Invalid mode",
					error: `Pick "${MODE_INSTANT}" or "${offlineLabel}".`,
				};
			} else {
				modeCell.value = "Instant only";
				modeCell.font = { size: 9, color: { argb: "FF64748B" } };
			}

			if (def.defaultAvg !== null) {
				const avgCell = markInputCell(ws, `D${row}`);
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

			const txnsCell = markInputCell(ws, `E${row}`);
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

			const perTxnCell = ws.getCell(`F${row}`);
			const perTxnValue = def.perTxn(`D${row}`, `C${row}`);
			perTxnCell.value =
				typeof perTxnValue === "number"
					? perTxnValue
					: { formula: perTxnValue };
			perTxnCell.numFmt = RATE_FORMAT;

			const earningsCell = ws.getCell(`G${row}`);
			earningsCell.value = { formula: `IFERROR(N(F${row})*N(E${row}),0)` };
			earningsCell.numFmt = INR_FORMAT;
			earningsCell.font = { color: { argb: SUCCESS } };

			if (def.notes) {
				const notesCell = ws.getCell(`H${row}`);
				notesCell.value = def.notes;
				notesCell.font = { size: 9, color: { argb: "FF64748B" } };
			}

			row++;
		}
		familyRanges.push({ first: familyFirstRow, last: row - 1 });
	}

	row++; // spacer

	// -- Summary block ----------------------------------------------------------
	const summaryRow = (
		label: string,
		formula: string,
		opts?: { gold?: boolean },
	) => {
		ws.mergeCells(`A${row}:F${row}`);
		const labelCell = ws.getCell(`A${row}`);
		labelCell.value = label;
		labelCell.alignment = { horizontal: "right" };
		labelCell.font = { bold: true, size: opts?.gold ? 12 : 10 };
		const valueCell = ws.getCell(`G${row}`);
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
		`SUM(G${firstDataRow}:G${lastDataRow})`,
	);
	const tdsRow = summaryRow(
		`Less TDS @ ${tdsPct}%`,
		`G${grossRow}*${data.tdsRate}`,
	);
	summaryRow("Indicative net monthly payout", `G${grossRow}-G${tdsRow}`, {
		gold: true,
	});

	// One-time cost, deliberately below the payout headline and never netted
	// off it. One fee per API family, activated by any non-zero txn count in
	// that family's block — matching calcPaymentsSetupFee on the web.
	const netFactor = (100 - data.setupFeeDiscountPercent) / 100;
	const familyFees = familyRanges
		.map(
			({ first, last }) => `IF(SUM(E${first}:E${last})>0,${data.bcSetupFee},0)`,
		)
		.join("+");
	summaryRow(
		setupFeeLabel(data.setupFeeDiscountPercent),
		familyFees ? `(${familyFees})*${netFactor}` : "0",
	);

	row++; // spacer

	// -- Footnotes ----------------------------------------------------------------
	const footnotes = [
		"Estimates use your AVERAGE transaction amount; actual earnings depend on each transaction's slab.",
		`AePS fund settlements carry a charge of ${aeps.settlementCharges.map((slab) => `₹${slab.flat} (${slab.upTo === null ? `above ₹${(slab.from - 1).toLocaleString("en-IN")}` : `up to ₹${slab.upTo.toLocaleString("en-IN")}`})`).join(" / ")} + GST.`,
		"Where BBPS operator rates vary, the LOWEST rate is used for a conservative estimate.",
		`BBPS settlement mode is set per transaction with the "communication" parameter (${bbps.modeParam.online} = instant, ${bbps.modeParam.offline} = ${bbps.offlineSettlementHours}-hour, higher commission), sent on BOTH Fetch Bill and Pay Bill.`,
	];
	for (const note of footnotes) {
		footnoteRow(ws, row, "H", note);
		row++;
	}

	// Internal link to the full BBPS operator list
	const opsLink = fullWidthRow(ws, row, "H", {
		text: `Operator-wise BBPS rates (${bbps.operators.length} billers) → see the "${SHEETS.bbpsOperators}" sheet`,
		hyperlink: `#'${SHEETS.bbpsOperators}'!A1`,
	});
	opsLink.font = { size: 9, underline: true, color: { argb: "FF0563C1" } };
	row++;

	await protectSheet(ws);
}
