import { describe, expect, it } from "vitest";
import {
	creditOf,
	debitOf,
	deriveAmount,
	describeRow,
	inferSearchField,
	initialsOf,
	statusOf,
	totalsOf,
	type TransactionRow,
} from "@/lib/console/transactions";

/** A zeroed row; each test overrides only the fields it exercises. */
function row(overrides: Partial<TransactionRow> = {}): TransactionRow {
	return {
		tid: "2886973933",
		tx_typeid: 1,
		tx_name: "Digi Khata Load Wallet",
		amount_dr: 0,
		amount_cr: 0,
		fee: 0,
		commission_earned: 0,
		bonus: 0,
		tds: 0,
		gst: 0,
		insurance_amount: 0,
		eko_service_charge: 0,
		eko_gst: 0,
		r_bal: 0,
		status: "Success",
		response_status_id: 0,
		datetime: "2026-04-16 11:49:00",
		...overrides,
	};
}

describe("debitOf", () => {
	it("sums the debit leg with every charge levied on it", () => {
		const r = row({
			amount_dr: 1000,
			fee: 10,
			tds: 1,
			gst: 2,
			insurance_amount: 5,
			eko_gst: 3,
		});
		expect(debitOf(r)).toBe(1021);
	});

	it("is 0 for a failed transaction — no money moved", () => {
		expect(
			debitOf(row({ amount_dr: 200000, fee: 10, response_status_id: 1 })),
		).toBe(0);
	});

	it("ignores negative components rather than subtracting them", () => {
		expect(debitOf(row({ amount_dr: 100, fee: -50 }))).toBe(100);
	});

	it("is 0 for a pure credit row", () => {
		expect(debitOf(row({ amount_cr: 500 }))).toBe(0);
	});
});

describe("creditOf", () => {
	it("sums the credit leg with everything earned on it", () => {
		const r = row({
			amount_cr: 1000,
			commission_earned: 20,
			eko_service_charge: 5,
			bonus: 2,
		});
		expect(creditOf(r)).toBe(1027);
	});

	it("is 0 for a failed transaction", () => {
		expect(
			creditOf(
				row({ amount_cr: 900, commission_earned: 20, response_status_id: 1 }),
			),
		).toBe(0);
	});
});

describe("deriveAmount", () => {
	it("reads a debit row", () => {
		expect(deriveAmount(row({ amount_dr: 200000 }))).toEqual({
			amount: 200000,
			trxType: "DR",
		});
	});

	it("reads a credit row", () => {
		expect(deriveAmount(row({ amount_cr: 750 }))).toEqual({
			amount: 750,
			trxType: "CR",
		});
	});
});

describe("totalsOf", () => {
	it("sums debits and credits across the page and takes the newest balance", () => {
		const rows = [
			row({ amount_dr: 100, fee: 5, r_bal: 2800000 }),
			row({ amount_cr: 50, r_bal: 2900000 }),
			row({ amount_dr: 200000, r_bal: 3000000, response_status_id: 1 }),
		];
		// The third row failed, so it contributes nothing to either total.
		expect(totalsOf(rows)).toEqual({
			debit: 105,
			credit: 50,
			closing: 2800000,
		});
	});

	it("has no closing balance for an empty page", () => {
		expect(totalsOf([])).toEqual({ debit: 0, credit: 0, closing: null });
	});
});

describe("inferSearchField", () => {
	// The ranges overlap by design, so order-of-checks IS the spec.
	it.each([
		["9876543210", "customer_mobile"], // 10 digits starting 6-9
		["1234", "amount"], // short
		["12.50", "amount"], // decimal
		["1234567", "amount"], // 7 digits, upper bound of amount
		["12345678901", "tid"], // 11 digits
		["1234567890", "tid"], // 10 digits NOT starting 6-9 → not a mobile
		["123456789012", "account"], // 12 digits
		["123456789012345678", "account"], // 18 digits, upper bound
	] as const)("classifies %s as %s", (query, expected) => {
		expect(inferSearchField(query)?.field).toBe(expected);
	});

	it.each([
		["", "empty"],
		["   ", "blank"],
		["abcdef", "non-numeric"],
		["0", "zero"],
		["1234567890123456789", "over 18 digits"],
	])("rejects %s (%s)", (query) => {
		expect(inferSearchField(query)).toBeNull();
	});

	it("strips grouping separators from a pasted amount", () => {
		// The normalized value is what gets sent: the backend's amount rule rejects
		// commas, so returning the raw "2,00,000" would 400 on the user's own paste.
		expect(inferSearchField("2,00,000")).toEqual({
			field: "amount",
			value: "200000",
		});
	});

	it("returns the value to send alongside the field", () => {
		expect(inferSearchField("  9876543210  ")).toEqual({
			field: "customer_mobile",
			value: "9876543210",
		});
	});
});

describe("statusOf", () => {
	it("maps a known response_status_id", () => {
		expect(statusOf(row({ response_status_id: 1, status: "Failed" }))).toEqual({
			label: "Failed",
			variant: "destructive",
		});
	});

	it("prefers upstream's own wording over the id's generic label", () => {
		// A real interaction-154 row: id 5 means "Hold" generically, but upstream
		// calls this one "Payment received". Showing "Hold" would be a lie.
		expect(
			statusOf(row({ response_status_id: 5, status: "Payment received" })),
		).toEqual({ label: "Payment received", variant: "secondary" });
	});

	it("falls back to the id's label when upstream sends no status string", () => {
		expect(statusOf(row({ response_status_id: 5, status: "" }))).toEqual({
			label: "Hold",
			variant: "secondary",
		});
	});

	it("keeps an unmapped id readable rather than blank", () => {
		expect(statusOf(row({ response_status_id: 99, status: "Weird" }))).toEqual({
			label: "Weird",
			variant: "outline",
		});
		expect(statusOf(row({ response_status_id: 99, status: "" }))).toEqual({
			label: "Unknown",
			variant: "outline",
		});
	});
});

describe("initialsOf", () => {
	it("takes the first and last words", () => {
		expect(initialsOf("Digi Khata Load Wallet")).toBe("DW");
	});

	it("handles a single word", () => {
		expect(initialsOf("Recharge")).toBe("R");
	});

	it("falls back for a name with no letters", () => {
		expect(initialsOf("12345")).toBe("?");
	});
});

describe("describeRow", () => {
	it("joins whichever counterparty fields exist", () => {
		expect(describeRow(row({ customer_name: "Asha", bank: "HDFC Bank" }))).toBe(
			"Asha · HDFC Bank",
		);
	});

	it("is empty when the row carries no counterparty", () => {
		expect(describeRow(row())).toBe("");
	});
});
