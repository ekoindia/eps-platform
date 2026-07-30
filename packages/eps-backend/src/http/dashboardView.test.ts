import { describe, expect, it } from "vitest";
import {
	SAMPLE_DASHBOARD_OBJECT,
	SAMPLE_SERVICE_LIST,
} from "./dashboard.sample";
import { buildDashboardView, parseServiceList, shapeOf } from "./dashboardView";

const services = parseServiceList(SAMPLE_SERVICE_LIST);
const range = {
	datefrom: "2026-07-22 00:00:00",
	dateto: "2026-07-28 23:59:59",
};

/** Builds a view from the sample, with `dashboard_object` overrides applied. */
function build(overrides: Record<string, unknown> = {}, list = services) {
	return buildDashboardView({
		preset: "last7",
		range,
		dashboardObject: { ...SAMPLE_DASHBOARD_OBJECT, ...overrides },
		services: list,
	});
}

describe("parseServiceList", () => {
	it("reads the top-level param_attributes.list_elements", () => {
		expect(services).toEqual([
			{ typeId: "81", label: "Accept Payment" },
			{ typeId: "82", label: "Fund Transfer" },
			{ typeId: "96", label: "GSTIN Verify" },
		]);
	});

	it("returns an empty list for a failed or unexpected envelope", () => {
		expect(parseServiceList({ status: 1, message: "nope" })).toEqual([]);
		expect(parseServiceList(null)).toEqual([]);
		// Rows missing an id or a label are unusable as a name map.
		expect(
			parseServiceList({
				param_attributes: { list_elements: [{ label: "", tx_typeid: 81 }] },
			}),
		).toEqual([]);
	});
});

describe("shapeOf", () => {
	it("reports keys and kinds, never values", () => {
		const shape = shapeOf(SAMPLE_DASHBOARD_OBJECT);
		expect(shape).toContain("successRate:object{3}");
		expect(shape).toContain("verificationTrends:array[2]");
		// No number from the body may leak into a log line.
		expect(shape).not.toContain("29549");
		expect(shape).not.toContain("939");
	});

	it("names the shape a JSON-encoded block decodes to", () => {
		expect(shapeOf({ verificationTrends: "[{}]" })).toBe(
			"verificationTrends:string→array[1]",
		);
		expect(shapeOf({ successRate: "{oops" })).toBe(
			"successRate:string→unparseable",
		);
	});

	it("describes a missing or wrongly-typed block", () => {
		expect(shapeOf(null)).toBe("<null>");
		expect(shapeOf({ successRate: null })).toBe("successRate:null");
	});
});

describe("buildDashboardView", () => {
	it("maps the overview, reading snake and camel response keys alike", () => {
		const { view } = build();
		expect(view.overview.transactions).toEqual({ value: 939, lastPeriod: 720 });
		expect(view.overview.successCases).toEqual({ value: 222, lastPeriod: 200 });
		expect(view.overview.failedCases).toEqual({ value: 456, lastPeriod: 400 });
		expect(view.overview.pending).toEqual({ value: 29, lastPeriod: 31 });
		expect(view.overview.gtv).toEqual({ value: 29_549, lastPeriod: 24_100 });
		expect(view.overview.revenue).toEqual({ value: 350.34, lastPeriod: 300.1 });
		expect(view.successRates).toHaveLength(3);
		expect(view.mostUsedServices[0]).toEqual({
			typeId: "81",
			name: "Accept Payment",
			totalCount: 223,
			totalRevenue: 120.5,
		});
		// Absent upstream field, not a hole in the view.
		expect(view.mostUsedServices[2].totalRevenue).toBe(0);
		expect(view.usage).toHaveLength(2);
		expect(view.range).toEqual({
			preset: "last7",
			from: range.datefrom,
			to: range.dateto,
		});
	});

	it("never carries the agent-network fields to the browser", () => {
		const { view } = build();
		const json = JSON.stringify(view);
		for (const field of ["activeAgents", "onboardedAgents", "commissionDue"]) {
			expect(json).not.toContain(field);
		}
	});

	it("sorts services by volume and GTV, largest first", () => {
		const { view } = build();
		expect(view.mostUsedServices.map((s) => s.typeId)).toEqual([
			"81",
			"82",
			"96",
		]);
		expect(view.successRates.map((s) => s.typeId)).toEqual(["96", "82", "81"]);
		expect(view.overview.breakdown.map((s) => s.amount)).toEqual([
			18_000, 8_549, 3_000,
		]);
	});

	it("parses typeBreakdown whether it is an object or a JSON string", () => {
		const asString = build({
			products_overview: {
				...SAMPLE_DASHBOARD_OBJECT.products_overview,
				gtv: {
					...SAMPLE_DASHBOARD_OBJECT.products_overview.gtv,
					typeBreakdown: JSON.stringify(
						SAMPLE_DASHBOARD_OBJECT.products_overview.gtv.typeBreakdown,
					),
				},
			},
		});
		expect(asString.view.overview.breakdown).toEqual(
			build().view.overview.breakdown,
		);
	});

	it("yields an empty breakdown for malformed typeBreakdown rather than throwing", () => {
		const { view } = build({
			products_overview: {
				...SAMPLE_DASHBOARD_OBJECT.products_overview,
				gtv: {
					...SAMPLE_DASHBOARD_OBJECT.products_overview.gtv,
					typeBreakdown: "{not json",
				},
			},
		});
		expect(view.overview.breakdown).toEqual([]);
		// The rest of the overview survives one bad field.
		expect(view.overview.transactions.value).toBe(939);
	});

	it("coerces numeric strings and treats absent blocks as zero", () => {
		const { view } = build({
			products_overview: {
				transactions: { transactions: "939", lastPeriod: "" },
			},
		});
		expect(view.overview.transactions).toEqual({ value: 939, lastPeriod: 0 });
		expect(view.overview.failedCases).toEqual({ value: 0, lastPeriod: 0 });
		expect(view.overview.breakdown).toEqual([]);
	});

	it("falls back to Service <id> when the 1044 list is unavailable", () => {
		const { view } = build({}, []);
		expect(view.successRates.map((s) => s.name)).toEqual([
			"Service 96",
			"Service 82",
			"Service 81",
		]);
		// The breakdown carries upstream's own names, so it survives a missing list.
		expect(view.overview.breakdown[0].name).toBe("Accept Payment");
	});

	it("reports absent datasets, distinguishing them from present-and-zero", () => {
		expect(build().absent).toEqual([]);
		const { view, absent } = buildDashboardView({
			preset: "today",
			range,
			dashboardObject: {
				products_overview: { transactions: { transactions: 0 } },
			},
			services,
		});
		expect(absent).toEqual([
			"successRate",
			"mostUsedServices",
			"verificationTrends",
		]);
		expect(view.overview.transactions.value).toBe(0);
	});

	it("parses every dataset whether it is an object or a JSON string", () => {
		// Upstream JSON-encodes `typeBreakdown` on some accounts; nothing says the
		// other blocks are exempt, and a silently-empty widget is what that costs.
		const encoded = build({
			successRate: JSON.stringify(SAMPLE_DASHBOARD_OBJECT.successRate),
			mostUsedServices: JSON.stringify(
				SAMPLE_DASHBOARD_OBJECT.mostUsedServices,
			),
			verificationTrends: JSON.stringify(
				SAMPLE_DASHBOARD_OBJECT.verificationTrends,
			),
		});
		expect(encoded.view.successRates).toEqual(build().view.successRates);
		expect(encoded.view.mostUsedServices).toEqual(
			build().view.mostUsedServices,
		);
		expect(encoded.view.usage).toEqual(build().view.usage);
	});

	it("rejects a service map that arrives as an array, rather than inventing ids", () => {
		// `Object.entries` on an array yields "0","1","2" — three rows named
		// `Service 0` read as data, which is worse than an empty widget.
		const { view } = build({
			successRate: [{ successCount: 1, totalCount: 2 }],
			mostUsedServices: [{ totalCount: 9 }],
		});
		expect(view.successRates).toEqual([]);
		expect(view.mostUsedServices).toEqual([]);
	});

	it("falls back to the success-rate volumes when mostUsedServices is empty", () => {
		for (const wrong of [undefined, null, {}, "{}"]) {
			const { view } = build({ mostUsedServices: wrong });
			expect(view.mostUsedServices).toEqual([
				{
					typeId: "96",
					name: "GSTIN Verify",
					totalCount: 169,
					totalRevenue: 0,
				},
				{
					typeId: "82",
					name: "Fund Transfer",
					totalCount: 150,
					totalRevenue: 0,
				},
				{
					typeId: "81",
					name: "Accept Payment",
					totalCount: 17,
					totalRevenue: 0,
				},
			]);
		}
		// Primary data still wins whenever upstream sends any.
		expect(build().view.mostUsedServices[0].totalCount).toBe(223);
	});

	it("scopes the fallback to the active service filter", () => {
		// `success_rate` is never sent `typeid`, so an unfiltered fallback would
		// contradict the dropdown that asked for one service.
		const { view } = buildDashboardView({
			preset: "last7",
			range,
			dashboardObject: { ...SAMPLE_DASHBOARD_OBJECT, mostUsedServices: {} },
			services,
			typeId: "82",
		});
		expect(view.mostUsedServices).toEqual([
			{ typeId: "82", name: "Fund Transfer", totalCount: 150, totalRevenue: 0 },
		]);
	});

	it("survives a null or wrongly-typed dashboard_object", () => {
		const { view, absent } = buildDashboardView({
			preset: "today",
			range,
			dashboardObject: null,
			services,
		});
		expect(view.overview.transactions.value).toBe(0);
		expect(view.usage).toEqual([]);
		expect(absent).toHaveLength(4);
	});
});
