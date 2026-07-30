import { buildIssueCatalogue, isRaiseWindowOpen } from "@/lib/connect/support";
import { describe, expect, it } from "vitest";

const ROWS = [
	{
		label: "Money not received",
		category: { id: 1, title: "Payment" },
		sub_category: { id: 10, title: "DMT" },
	},
	{
		label: "Wrong account",
		category: { id: 1, title: "Payment" },
		sub_category: { id: 10, title: "DMT" },
	},
	{
		label: "KYC pending",
		category: { id: 2, title: "Account" },
		sub_category: { id: 20, title: "Onboarding" },
		comment: 1,
		desc: "Tell us what you saw",
	},
];

describe("buildIssueCatalogue", () => {
	it("indexes categories and sub-categories once each", () => {
		const catalogue = buildIssueCatalogue(ROWS);

		expect(catalogue.categories.map((c) => c.title)).toEqual([
			"Payment",
			"Account",
		]);
		expect(catalogue.subCategories[1]).toHaveLength(1);
		expect(catalogue.issues).toHaveLength(3);
	});

	it("fills the defaults the upstream leaves out", () => {
		const [first, , third] = buildIssueCatalogue(ROWS).issues;

		expect(first.comment).toBe(0);
		expect(first.screenshot).toBe(0);
		expect(first.raise_issue_after).toBe("0d");
		// The value defaults to the label, and an explicit desc survives.
		expect(first.value).toBe("Money not received");
		expect(third.comment).toBe(1);
		expect(third.desc).toBe("Tell us what you saw");
	});

	it("survives a missing list", () => {
		expect(buildIssueCatalogue(undefined).issues).toEqual([]);
	});
});

describe("isRaiseWindowOpen", () => {
	const noon = new Date("2026-07-27T12:00:00").getTime();

	it("holds an issue back until its window opens", () => {
		const issue = { raise_issue_after: "2h" };

		expect(isRaiseWindowOpen(issue, "2026-07-27 11:00:00", noon)).toBe(false);
		expect(isRaiseWindowOpen(issue, "2026-07-27 09:00:00", noon)).toBe(true);
	});

	it("opens immediately without a window, a time, or a parseable time", () => {
		expect(
			isRaiseWindowOpen({ raise_issue_after: "0d" }, "2026-07-27 11:59", noon),
		).toBe(true);
		expect(
			isRaiseWindowOpen({ raise_issue_after: "1d" }, undefined, noon),
		).toBe(true);
		expect(
			isRaiseWindowOpen({ raise_issue_after: "1d" }, "not a date", noon),
		).toBe(true);
	});

	it("reads days and minutes, not just hours", () => {
		expect(
			isRaiseWindowOpen(
				{ raise_issue_after: "1d" },
				"2026-07-26 13:00:00",
				noon,
			),
		).toBe(false);
		expect(
			isRaiseWindowOpen(
				{ raise_issue_after: "30m" },
				"2026-07-27 11:00:00",
				noon,
			),
		).toBe(true);
	});
});
