/**
 * A SYNTHETIC interaction-682 `dashboard_object`, in the shape Eloka's widgets
 * read.
 *
 * Deliberately hand-written rather than captured from a live account: a real
 * body is one partner's revenue, volume and service mix, and that does not
 * belong in a repository. Every number here is made up; only the SHAPE is real,
 * and the shape is what the tests are about.
 *
 * When a UAT run shows upstream's shape differs, change this file and let its
 * tests say what broke — same contract `transactions.sample.ts` holds for
 * interaction 154.
 */
export const SAMPLE_DASHBOARD_OBJECT = {
	products_overview: {
		gtv: {
			amount: 29_549,
			lastPeriod: 24_100,
			revenue: 350.34,
			// Upstream's own casing: a lowercase `l` in the middle of the word.
			revenuelastPeriod: 300.1,
			averageRevenue: 0.37,
			averageRevenueLastPeriod: 0.41,
			typeBreakdown: {
				"81": { name: "Accept Payment", amount: 18_000 },
				"82": { name: "Fund Transfer", amount: 8_549 },
				"96": { name: "GSTIN Verify", amount: 3_000 },
			},
		},
		transactions: { transactions: 939, lastPeriod: 720 },
		successCases: { successCases: 222, lastPeriod: 200 },
		failedCases: { failedCases: 456, lastPeriod: 400 },
		raCases: { raCases: 29, lastPeriod: 31 },
		// Network fields the EPS console drops on purpose — kept here so the test
		// can assert they do NOT reach the view.
		activeAgents: { active: 2, lastPeriod: 3 },
		onboardedAgents: { onboarded: 0, lastMonth: 1 },
		commissionDue: { commissionDue: 0, lastPeriod: 0 },
	},
	successRate: {
		"81": { successCount: 12, totalCount: 17 },
		"82": { successCount: 22, totalCount: 150 },
		"96": { successCount: 169, totalCount: 169 },
	},
	mostUsedServices: {
		"81": { totalCount: 223, totalRevenue: 120.5 },
		"82": { totalCount: 184, totalRevenue: 90 },
		// No `totalRevenue` — upstream omits it on some services.
		"96": { totalCount: 169 },
	},
	verificationTrends: [
		{
			startDate: "2026-07-27T00:00:00",
			endDate: "2026-07-27T23:59:59",
			totalCount: 12,
		},
		{
			startDate: "2026-07-28T00:00:00",
			endDate: "2026-07-28T23:59:59",
			totalCount: 63,
		},
	],
};

/** A SYNTHETIC interaction-1044 envelope: the `tx_typeid` → label master list. */
export const SAMPLE_SERVICE_LIST = {
	param_attributes: {
		list_elements: [
			{ label: "Accept Payment", tx_typeid: 81 },
			{ label: "Fund Transfer", tx_typeid: 82 },
			{ label: "GSTIN Verify", tx_typeid: 96 },
		],
	},
};
