import { describe, it, expect } from "vitest";
import { mapAccounts, selectEvalueAccountId } from "./accounts";

/**
 * Shaped after a real `account_detail`, captured via Eloka's session fixture
 * (`wlc-webapp/__tests__/fixtures/session/user.mock.ts`). The second entry is
 * the synthetic row connect-api appends (`routes/authentication.js:869`).
 */
const REAL = {
	code: "20810282",
	evalue_account_id: "392961",
	account_list: [
		{ no_filter: 0, type_id: 1, product_id: 1, id: 392961, label: "E-value" },
		{
			id: -500000,
			label: "Response Awaited Transactions",
			no_filter: 0,
			product_id: 1,
		},
	],
};

describe("mapAccounts", () => {
	it("drops the synthetic Response-Awaited pseudo-account", () => {
		// connect-api invents this row for Eloka's history filter UI; SimpliBank
		// never sends it and would not accept its id as an account_id.
		const accounts = mapAccounts(REAL);
		expect(accounts).toEqual([
			{ id: 392961, label: "E-value", productId: 1, typeId: 1 },
		]);
	});

	it("returns an empty list when there is no account block", () => {
		expect(mapAccounts(undefined)).toEqual([]);
		expect(mapAccounts({})).toEqual([]);
		expect(mapAccounts({ account_list: "nope" })).toEqual([]);
	});

	it("coerces string ids and tolerates missing labels", () => {
		expect(mapAccounts({ account_list: [{ id: "77" }] })).toEqual([
			{ id: 77, label: "", productId: 0, typeId: 0 },
		]);
	});
});

describe("selectEvalueAccountId", () => {
	it("prefers the block's own evalue_account_id", () => {
		expect(selectEvalueAccountId(REAL)).toBe("392961");
	});

	it("falls back to the E-value entry when the id is absent", () => {
		expect(selectEvalueAccountId({ account_list: REAL.account_list })).toBe(
			"392961",
		);
	});

	it("matches the E-value entry by product, not by position", () => {
		// Eloka reaches the same row by defaulting its account switcher to index 0.
		// This service has no switcher, so relying on order would be luck.
		const reordered = {
			account_list: [
				{ id: 88, label: "Some other product", product_id: 4, type_id: 2 },
				{ id: 392961, label: "E-value", product_id: 1, type_id: 1 },
			],
		};
		expect(selectEvalueAccountId(reordered)).toBe("392961");
	});

	it("never selects a synthetic negative id, even as the only entry", () => {
		expect(
			selectEvalueAccountId({
				account_list: [
					{
						id: -500000,
						label: "Response Awaited Transactions",
						product_id: 1,
					},
				],
			}),
		).toBeNull();
	});

	it("ignores a non-positive evalue_account_id and keeps looking", () => {
		expect(
			selectEvalueAccountId({
				evalue_account_id: "0",
				account_list: REAL.account_list,
			}),
		).toBe("392961");
	});

	it("returns null rather than guessing when nothing identifies the account", () => {
		// The caller answers 502. Falling back to "first entry" here would report
		// another account's transaction history as this user's.
		expect(selectEvalueAccountId(undefined)).toBeNull();
		expect(selectEvalueAccountId({ account_list: [] })).toBeNull();
		expect(
			selectEvalueAccountId({
				account_list: [{ id: 88, label: "Other", product_id: 4, type_id: 2 }],
			}),
		).toBeNull();
	});
});
