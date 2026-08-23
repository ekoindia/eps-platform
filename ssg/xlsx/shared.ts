import type { Worksheet } from "exceljs";
import type { PricedApi } from "../../src/lib/data/api-pricing";
import type {
	AmountSlab,
	BbpsCategory,
} from "../../src/lib/data/payments-pricing";
import type { DmtTxnBreakdown } from "../../src/lib/data/dmt-pricing";
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
	dmt: "DMT Calculator",
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
/**
 * Summary-row label for the one-time setup fee, in the three discount states.
 * @param percent - `SETUP_FEE_DISCOUNT_PERCENT`
 */
export const setupFeeLabel = (percent: number): string => {
	if (percent >= 100) return "One-time setup fee (waived — limited-time offer)";
	return percent > 0
		? `One-time setup fee (${percent}% off — limited-time offer)`
		: "One-time setup fee";
};

/**
 * Intro note for the one-time setup fee, or `null` when no offer is running
 * and the note would say nothing the summary row does not already show.
 * @param percent - `SETUP_FEE_DISCOUNT_PERCENT`
 * @param verificationFee - Standard per-API fee in ₹
 */
export const setupFeeNote = (
	percent: number,
	verificationFee: number,
): string | null => {
	const fee = `₹${verificationFee.toLocaleString("en-IN")}`;
	if (percent >= 100) {
		return `One-time setup fee: ${fee} per API — currently ₹0, waived as a limited-time offer.`;
	}
	return percent > 0
		? `One-time setup fee: ${fee} per API — currently ${percent}% off as a limited-time offer.`
		: null;
};

export interface PricingXlsxData {
	/** `PRICING_GROUPS` — verification APIs grouped and ordered for display. */
	groups: { label: string; apis: PricedApi[] }[];
	/** `GST_RATE` — e.g. 0.18. */
	gstRate: number;
	/** `SETUP_FEE_DISCOUNT_PERCENT` — 0–100; 100 = fully waived. */
	setupFeeDiscountPercent: number;
	/** `VERIFICATION_SETUP_FEE` — one-time fee per verification API (₹). */
	verificationSetupFee: number;
	/** `BC_SETUP_FEE` — one-time fee per BC/Payments API family (₹). */
	bcSetupFee: number;
	/** `TDS_RATE` — withheld from commission payouts, e.g. 0.02. */
	tdsRate: number;
	/** `HAS_VOLUME_DISCOUNTS` — any API with more than one tier. */
	hasVolumeDiscounts: boolean;
	/** `MAX_VOLUME` — upper bound for the usage-input validation. */
	maxVolume: number;
	/** `SITE_URL` — canonical site origin for the live-calculator link. */
	siteUrl: string;
	/** `displayName` helper from api-pricing. */
	displayName: (api: PricedApi) => string;
	/** DMT charge config from dmt-pricing (commission is closed-form). */
	dmt: {
		/** `dmtRateCardRows()` — derived ledger rows for the static rate card. */
		rows: DmtTxnBreakdown[];
		senderKycFee: number;
		/** `DMT_SENDER_KYC_FEE` + GST — what actually leaves the wallet. */
		senderKycInclGst: number;
		/** `DMT_RECIPIENT_VERIFY_FEE` — GST-inclusive, per new recipient. */
		recipientVerifyFee: number;
		customerFeePct: number;
		customerFeeMin: number;
		/** `EKO_DMT_CHARGE` — flat per transaction, excl. GST. */
		ekoCharge: number;
		minTxnAmount: number;
		maxTxnAmount: number;
		defaultAmount: number;
		defaultMonthlyTxns: number;
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
