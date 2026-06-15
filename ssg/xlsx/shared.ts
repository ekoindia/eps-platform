import type { Worksheet } from "exceljs";
import type { PricedApi } from "../../src/lib/data/api-pricing";
import type {
	AmountSlab,
	BbpsCategory,
	DmtSlab,
} from "../../src/lib/data/payments-pricing";
import type { BbpsOperator } from "../../src/lib/data/bbps-operators";

/**
 * Shared styling constants and helpers for the pricing-workbook sheet
 * builders, plus the data contract handed over by the Vite plugin.
 */

/** Sheet names (all ≤31 chars, Excel's limit) — single source for builders,
 * the Index TOC hyperlinks and tests. Order here = workbook tab order. */
export const SHEETS = {
	index: "Index",
	verificationCalculator: "Verification Calculator",
	paymentsEarnings: "Payments Earnings",
	connectedBanking: "Connected Banking",
	verificationRateCard: "Verification Rate Card",
	paymentsRateCard: "Payments Rate Card",
	bbpsOperators: "BBPS Operator Rates",
} as const;

/**
 * Pricing inputs for the workbook renderer. Passed in (rather than imported)
 * so the renderer stays node-only and never drags exceljs near client code;
 * the Vite plugin loads the data modules via `ssrLoadModule` and hands the
 * data over.
 */
export interface PricingXlsxData {
	/** `PRICING_GROUPS` — verification APIs grouped and ordered for display. */
	groups: { label: string; apis: PricedApi[] }[];
	/** `GST_RATE` — e.g. 0.18. */
	gstRate: number;
	/** `SETUP_FEE_WAIVED` — limited-time-offer flag (verification APIs). */
	setupFeeWaived: boolean;
	/** `HAS_VOLUME_DISCOUNTS` — any API with more than one tier. */
	hasVolumeDiscounts: boolean;
	/** `MAX_VOLUME` — upper bound for the usage-input validation. */
	maxVolume: number;
	/** `SITE_URL` — canonical site origin for the live-calculator link. */
	siteUrl: string;
	/** `displayName` helper from api-pricing. */
	displayName: (api: PricedApi) => string;
	/** DMT commission config from payments-pricing. */
	dmt: {
		slabs: DmtSlab[];
		senderKycFee: number;
		customerFeePct: number;
		customerFeeMin: number;
		maxTxnAmount: number;
		tdsRate: number;
	};
	/** AePS commission config from payments-pricing. */
	aeps: {
		cashoutSlabs: AmountSlab[];
		miniStatementCommission: number;
		settlementCharges: AmountSlab[];
	};
	/** BBPS category config + full operator list. */
	bbps: {
		categories: BbpsCategory[];
		operators: BbpsOperator[];
	};
	/** Connected Banking config from connected-banking-pricing. */
	cb: {
		setupFee: number;
		banks: string[];
		txnSlabs: AmountSlab[];
		maxBankUsers: number;
	};
}

// Brand colours (ARGB) — derived from --color-eko-navy / --color-eko-gold in src/index.css.
export const NAVY = "FF033849";
export const GOLD = "FFFAB719";
export const INPUT_FILL = "FFFEF6E0"; // light gold — signals "type here"
export const HEADER_FILL = "FFF1F5F9"; // light slate
export const GROUP_FILL = "FFE8EEF1"; // light navy tint
export const SUCCESS = "FF15803D"; // green — earnings figures
export const MUTED = "FF64748B";
export const SLATE = "FF475569";

/** Indian-grouping rupee format (₹1,23,45,678) with plain fallback below 1 lakh. */
export const INR_FORMAT =
	'[>=10000000]"₹"##\\,##\\,##\\,##0;[>=100000]"₹"##\\,##\\,##0;"₹"#,##0';
export const RATE_FORMAT = '"₹"#,##0.00';

export const solidFill = (argb: string) =>
	({ type: "pattern", pattern: "solid", fgColor: { argb } }) as const;

/** Merged full-width text row; returns the master cell for further styling. */
export const fullWidthRow = (
	ws: Worksheet,
	row: number,
	lastCol: string,
	value: unknown,
) => {
	ws.mergeCells(`A${row}:${lastCol}${row}`);
	const cell = ws.getCell(`A${row}`);
	cell.value = value as string;
	return cell;
};

/** Navy banner title row spanning columns A..lastCol. */
export const brandedTitle = (
	ws: Worksheet,
	row: number,
	lastCol: string,
	text: string,
) => {
	const cell = fullWidthRow(ws, row, lastCol, text);
	cell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
	cell.fill = solidFill(NAVY);
	cell.alignment = { vertical: "middle" };
	ws.getRow(row).height = 30;
	return cell;
};

/** Muted intro/notes row spanning columns A..lastCol. */
export const introRow = (
	ws: Worksheet,
	row: number,
	lastCol: string,
	text: string,
) => {
	const cell = fullWidthRow(ws, row, lastCol, text);
	cell.font = { size: 10, color: { argb: SLATE } };
	return cell;
};

/** Styled column-header row; freezes panes just below it. */
export const headerRow = (ws: Worksheet, row: number, headers: string[]) => {
	headers.forEach((header, i) => {
		const cell = ws.getCell(row, i + 1);
		cell.value = header;
		cell.font = { bold: true, size: 10 };
		cell.fill = solidFill(HEADER_FILL);
		cell.border = { bottom: { style: "thin", color: { argb: NAVY } } };
	});
	ws.views = [{ state: "frozen", ySplit: row }];
};

/** Full-width group-band row (e.g. "DMT", "Bank Account"). */
export const groupBandRow = (
	ws: Worksheet,
	row: number,
	lastCol: string,
	label: string,
) => {
	const cell = fullWidthRow(ws, row, lastCol, label);
	cell.font = { bold: true, size: 10, color: { argb: NAVY } };
	cell.fill = solidFill(GROUP_FILL);
	return cell;
};

/** Small italic footnote row spanning columns A..lastCol. */
export const footnoteRow = (
	ws: Worksheet,
	row: number,
	lastCol: string,
	text: string,
) => {
	const cell = fullWidthRow(ws, row, lastCol, text);
	cell.font = { size: 9, italic: true, color: { argb: MUTED } };
	return cell;
};

/**
 * Protect a sheet without a password (Excel's "Unprotect Sheet" just works).
 * The goal is preventing accidental edits, not access control.
 */
export const protectSheet = (ws: Worksheet) =>
	ws.protect("", {
		selectLockedCells: true,
		selectUnlockedCells: true,
		formatColumns: true,
		formatRows: true,
	});

/** Mark a cell as an unlocked, highlighted input cell. */
export const markInputCell = (ws: Worksheet, address: string) => {
	const cell = ws.getCell(address);
	cell.fill = solidFill(INPUT_FILL);
	cell.protection = { locked: false };
	return cell;
};

/** Format an amount-slab range for sheet text, e.g. "₹101 – ₹3,000". */
export const slabRangeText = (slab: AmountSlab): string =>
	slab.upTo === null
		? `₹${slab.from.toLocaleString("en-IN")}+`
		: `₹${slab.from.toLocaleString("en-IN")} – ₹${slab.upTo.toLocaleString("en-IN")}`;

/** Format a slab's value for sheet text, e.g. "₹1.20" or "0.52% of amount". */
export const slabValueText = (slab: AmountSlab): string =>
	slab.flat !== undefined
		? `₹${slab.flat.toFixed(2)}`
		: `${((slab.pct ?? 0) * 100).toFixed(2).replace(/\.?0+$/, "")}% of amount`;
