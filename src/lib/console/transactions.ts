/**
 * Transaction History — types and pure logic.
 *
 * Everything here is presentation-agnostic and directly testable; the page is
 * just JSX over these functions. Ported from Eloka's (`wlc-webapp`) History
 * feature, minus its metadata-driven column engine: that array exists there to
 * drive two views with runtime-dynamic columns, export and print media, none of
 * which this page has.
 */

/**
 * One row of `transaction_list`, narrowed to the fields this page renders.
 *
 * Upstream sends many more (see docs/features/transaction-history.md). Money
 * fields arrive as numbers or numeric strings depending on the field, so the
 * backend mapper coerces them before they get here.
 */
export interface TransactionRow {
	tid: string;
	tx_typeid: number;
	tx_name: string;
	/** Debit leg. Mutually exclusive with `amount_cr` in practice. */
	amount_dr: number;
	/** Credit leg. */
	amount_cr: number;
	fee: number;
	commission_earned: number;
	bonus: number;
	tds: number;
	gst: number;
	insurance_amount: number;
	eko_service_charge: number;
	eko_gst: number;
	/** Running balance after this transaction. */
	r_bal: number;
	status: string;
	response_status_id: number;
	datetime: string;
	customer_name?: string;
	customer_mobile?: string;
	account?: string;
	bank?: string;
	operator?: string;
	rrn?: string;
	trackingnumber?: string;
	recipient_name?: string;
	recipient_mobile?: string;
}

/** One page of transactions, as returned by the BFF. */
export interface TransactionPage {
	rows: TransactionRow[];
	startIndex: number;
	limit: number;
	/**
	 * Whether to offer a Next page. A full-page heuristic — upstream returns no
	 * total count — so it can be true on a final, exactly-full page, which shows
	 * an empty page on Next rather than a wrong result.
	 */
	hasNext: boolean;
}

/** Filters accepted by the BFF. Keys match the upstream field names. */
export interface TransactionFilters {
	tid?: string;
	account?: string;
	customer_mobile?: string;
	amount?: string;
	/** From-date, `YYYY-MM-DD`. */
	start_date?: string;
	/** To-date, `YYYY-MM-DD`. */
	tx_date?: string;
	/** Tracking number. */
	rr_no?: string;
}

/** Rows per page. Matches Eloka's `tableRowLimit.XLARGE`. */
export const PAGE_LIMIT = 25;

/** `response_status_id` meaning the transaction failed; its money is not moved. */
const STATUS_FAILURE = 1;

/** Badge variants, narrowed to what the status pill uses. */
type StatusVariant = "default" | "secondary" | "destructive" | "outline";

/**
 * `response_status_id` → Badge variant, plus a fallback label.
 *
 * This map is authoritative for the VARIANT (the colour) only. The label comes
 * from the row's own `status` string wherever upstream sends one — see
 * `statusOf`.
 */
export const RESPONSE_STATUS: Record<
	number,
	{
		label: string;
		variant: StatusVariant;
	}
> = {
	0: { label: "Success", variant: "default" },
	1: { label: "Failed", variant: "destructive" },
	2: { label: "Initiated", variant: "secondary" },
	3: { label: "Refund initiated", variant: "secondary" },
	5: { label: "Hold", variant: "secondary" },
	8: { label: "Scheduled", variant: "outline" },
	9: { label: "Scheduled expired", variant: "destructive" },
};

/**
 * Resolves a row's display status: upstream's own wording, our colour.
 *
 * The label PREFERS `row.status`, because one id spans several upstream
 * wordings — a real interaction-154 row carries `response_status_id: 5` with
 * `status: "Payment received"`, which this map alone would mislabel as "Hold".
 * Fall back to the map's label only when upstream sends no string.
 * @param row - The transaction row.
 * @returns The label to show, and the Badge variant to show it in.
 */
export function statusOf(row: TransactionRow): {
	label: string;
	variant: StatusVariant;
} {
	const mapped = RESPONSE_STATUS[row.response_status_id];
	return {
		label: row.status?.trim() || mapped?.label || "Unknown",
		variant: mapped?.variant ?? "outline",
	};
}

/** Sums the arguments, counting only strictly-positive values. */
const sumPositive = (...values: number[]): number =>
	values.reduce((total, v) => total + (v > 0 ? v : 0), 0);

/**
 * The transaction's headline amount and direction.
 *
 * Derived on read — unlike Eloka, which writes `amount`/`trx_type` back onto the
 * row and so has to re-derive them after every fetch.
 * @param row - The transaction row.
 * @returns The amount and whether it is a debit or credit.
 */
export function deriveAmount(row: TransactionRow): {
	amount: number;
	trxType: "DR" | "CR";
} {
	if (row.amount_dr > 0) return { amount: row.amount_dr, trxType: "DR" };
	return { amount: row.amount_cr, trxType: "CR" };
}

/**
 * Total money out for a row: the debit leg plus every charge levied on it.
 *
 * A failed transaction moves no money, so it contributes 0.
 * @param row - The transaction row.
 * @returns The debit total; 0 when failed or when nothing was debited.
 */
export function debitOf(row: TransactionRow): number {
	if (row.response_status_id === STATUS_FAILURE) return 0;
	return sumPositive(
		row.amount_dr,
		row.fee,
		row.tds,
		row.gst,
		row.insurance_amount,
		row.eko_gst,
	);
}

/**
 * Total money in for a row: the credit leg plus everything earned on it.
 * @param row - The transaction row.
 * @returns The credit total; 0 when failed or when nothing was credited.
 */
export function creditOf(row: TransactionRow): number {
	if (row.response_status_id === STATUS_FAILURE) return 0;
	return sumPositive(
		row.amount_cr,
		row.commission_earned,
		row.eko_service_charge,
		row.bonus,
	);
}

/**
 * Column totals for the rows currently on screen.
 *
 * PER-PAGE ONLY — upstream returns no grand totals, so these sum just this page,
 * and `closing` is the running balance of the newest row *on this page* under
 * the active filters, not the account's true closing balance. The UI labels it
 * as such.
 * @param rows - The current page's rows, newest first.
 * @returns Debit/credit sums and the newest row's running balance.
 */
export function totalsOf(rows: TransactionRow[]): {
	debit: number;
	credit: number;
	closing: number | null;
} {
	return {
		debit: rows.reduce((total, row) => total + debitOf(row), 0),
		credit: rows.reduce((total, row) => total + creditOf(row), 0),
		closing: rows.length > 0 ? rows[0].r_bal : null,
	};
}

/**
 * Guesses which field a quick-search query is meant to match, and normalizes it.
 *
 * The ranges genuinely overlap — a 10-digit input is both a valid mobile and a
 * valid TID — so the ORDER of these checks is the specification. Ported from
 * Eloka's `quickSearch`.
 *
 * Returns the CLEANED value, not the raw query: classification already strips
 * the grouping separators a pasted amount carries ("2,00,000"), and sending the
 * raw string instead would be rejected by the backend's filter rules — the
 * search would 400 on exactly the input the user pasted.
 * @param query - The raw search input.
 * @returns The filter key and the value to send, or null when unclassifiable.
 */
export function inferSearchField(
	query: string,
): { field: keyof TransactionFilters; value: string } | null {
	// Strip the grouping separators a pasted amount or account number may carry.
	const cleaned = query.replace(/(?<=[0-9])[ ,]/g, "").trim();
	const parsed = Number(cleaned);
	if (!cleaned || !Number.isFinite(parsed) || parsed === 0) return null;

	const { length } = cleaned;
	const isDecimal = cleaned.includes(".");
	if (length > 18) return null;

	const field = ((): keyof TransactionFilters | null => {
		if (length === 10 && /^[6-9]/.test(cleaned) && !isDecimal) {
			return "customer_mobile";
		}
		if (length <= 7) return "amount";
		if ((length === 10 || length === 11) && !isDecimal) return "tid";
		if (length >= 9 && !isDecimal) return "account";
		return null;
	})();
	return field ? { field, value: cleaned } : null;
}

/**
 * Initials for a transaction's avatar, e.g. "Digi Khata Load Wallet" → "DW".
 * @param name - The transaction name.
 * @returns Up to two uppercase initials, or "?" when the name has no letters.
 */
export function initialsOf(name: string): string {
	const words = name
		.replace(/[0-9]+/g, " ")
		.trim()
		.split(/\s+/)
		.filter(Boolean);
	if (words.length === 0) return "?";
	const letters = [
		words[0][0],
		words.length > 1 ? words[words.length - 1][0] : "",
	];
	return letters.join("").toUpperCase();
}

/**
 * A stable hue for a transaction name, so each product keeps one colour across
 * renders and pages without a colour table to maintain.
 * @param name - The transaction name.
 * @returns A hue in [0, 360).
 */
export function hueOf(name: string): number {
	let hash = 0;
	for (let i = 0; i < name.length; i++) {
		hash = (hash * 31 + name.charCodeAt(i)) % 360;
	}
	return hash;
}

/**
 * The sub-line under a transaction's name: whichever counterparty details the
 * row happens to carry. Ported from Eloka's `getNarrationText`, minus its
 * digit-stripping (which mangled bank names).
 * @param row - The transaction row.
 * @returns A short description, or "" when the row carries no counterparty.
 */
export function describeRow(row: TransactionRow): string {
	const parts = [
		row.customer_name,
		row.customer_mobile,
		row.bank,
		row.operator,
	].filter((part): part is string => Boolean(part && part.trim()));
	return parts.join(" · ");
}
