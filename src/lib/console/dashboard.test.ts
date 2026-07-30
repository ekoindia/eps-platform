import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardView, UsagePoint } from "@/lib/console/dashboard";
import {
	describeRange,
	deltaOf,
	fetchDashboard,
	formatBucketLabel,
	freshDashboard,
	isHourlyRange,
	resetDashboardCache,
	successPct,
	summarizeUsage,
} from "@/lib/console/dashboard";

vi.mock("@/lib/auth/client", async (orig) => ({
	...(await orig<typeof import("@/lib/auth/client")>()),
	dashboardClient: { load: vi.fn() },
}));

const { dashboardClient } = await import("@/lib/auth/client");
const load = vi.mocked(dashboardClient.load);

/** A minimal view; only the fields a given test reads are meaningful. */
function view(preset = "last7"): DashboardView {
	return {
		range: { preset, from: "2026-07-22 00:00:00", to: "2026-07-28 23:59:59" },
		overview: {
			transactions: { value: 1, lastPeriod: 0 },
			successCases: { value: 1, lastPeriod: 0 },
			failedCases: { value: 0, lastPeriod: 0 },
			pending: { value: 0, lastPeriod: 0 },
			gtv: { value: 0, lastPeriod: 0 },
			revenue: { value: 0, lastPeriod: 0 },
			averageRevenue: { value: 0, lastPeriod: 0 },
			breakdown: [],
		},
		successRates: [],
		mostUsedServices: [],
		usage: [],
		services: [],
	} as DashboardView;
}

/**
 * A usage bucket spanning `hours` from the given start.
 *
 * Both stamps are timezone-naive, like upstream's: formatting the end as UTC
 * while the start is read as local would fold the host's offset into the span.
 */
function bucket(start: string, hours: number, totalCount: number): UsagePoint {
	const to = new Date(new Date(start).getTime() + hours * 3_600_000);
	const pad = (n: number) => String(n).padStart(2, "0");
	const endDate =
		`${to.getFullYear()}-${pad(to.getMonth() + 1)}-${pad(to.getDate())}` +
		`T${pad(to.getHours())}:${pad(to.getMinutes())}:${pad(to.getSeconds())}`;
	return { startDate: start, endDate, totalCount };
}

beforeEach(() => {
	resetDashboardCache();
	load.mockReset();
});

describe("successPct", () => {
	it("is a percentage of the total", () => {
		expect(successPct(1, 4)).toBe(25);
	});

	it("is zero when nothing ran, rather than NaN", () => {
		expect(successPct(0, 0)).toBe(0);
	});
});

describe("deltaOf", () => {
	it("reports a rise and a fall", () => {
		expect(deltaOf({ value: 110, lastPeriod: 100 })).toEqual({
			label: "10.0%",
			up: true,
		});
		expect(deltaOf({ value: 90, lastPeriod: 100 })).toEqual({
			label: "10.0%",
			up: false,
		});
	});

	it("shows a multiple rather than a percentage past +100%", () => {
		expect(deltaOf({ value: 500, lastPeriod: 100 })?.label).toBe("5.0X");
	});

	it("shows nothing when there is nothing to compare or nothing changed", () => {
		expect(deltaOf({ value: 10, lastPeriod: 0 })).toBeNull();
		expect(deltaOf({ value: 0, lastPeriod: 10 })).toBeNull();
		expect(deltaOf({ value: 10, lastPeriod: 10 })).toBeNull();
	});
});

describe("usage series", () => {
	it("calls a one-hour bucket hourly and a one-day bucket daily", () => {
		expect(isHourlyRange([bucket("2026-07-28T10:00:00", 1, 4)])).toBe(true);
		expect(isHourlyRange([bucket("2026-07-28T00:00:00", 24, 4)])).toBe(false);
		// Exactly at the 2h boundary the labels are still hourly; past it, daily.
		expect(isHourlyRange([bucket("2026-07-28T00:00:00", 2, 4)])).toBe(true);
		expect(isHourlyRange([bucket("2026-07-28T00:00:00", 3, 4)])).toBe(false);
		expect(isHourlyRange([])).toBe(false);
	});

	it("labels by hour or by date accordingly", () => {
		const hourly = bucket("2026-07-28T13:00:00", 1, 4);
		expect(formatBucketLabel(hourly, true)).toMatch(/1\s*pm/i);
		expect(formatBucketLabel(hourly, false)).toContain("Jul");
	});

	it("derives the running total, average and peak", () => {
		const summary = summarizeUsage([
			bucket("2026-07-26T00:00:00", 24, 10),
			bucket("2026-07-27T00:00:00", 24, 30),
			bucket("2026-07-28T00:00:00", 24, 20),
		]);
		expect(summary.total).toBe(60);
		expect(summary.average).toBe(20);
		expect(summary.peak).toBe(30);
		expect(summary.peakLabel).toContain("27");
		expect(summary.series.map((p) => p.cumulativeCount)).toEqual([10, 40, 60]);
	});

	it("survives an empty series", () => {
		expect(summarizeUsage([])).toMatchObject({
			total: 0,
			average: 0,
			peak: 0,
			peakLabel: "—",
		});
	});
});

describe("describeRange", () => {
	it("names both ends of a multi-day window", () => {
		expect(describeRange(view().range)).toBe(
			"Showing stats from 22 Jul 2026 to 28 Jul 2026",
		);
	});

	it("names one day when the window opens and closes on it", () => {
		expect(
			describeRange({
				preset: "today",
				from: "2026-07-29 00:00:00",
				to: "2026-07-29 08:00:00",
			}),
		).toBe("Showing stats for 29 Jul 2026");
	});
});

describe("dashboard cache", () => {
	it("shares one request between concurrent callers", async () => {
		load.mockResolvedValue(view());
		await Promise.all([fetchDashboard("last7"), fetchDashboard("last7")]);
		expect(load).toHaveBeenCalledTimes(1);
	});

	it("does not share a request between different windows", async () => {
		load.mockResolvedValue(view());
		await Promise.all([fetchDashboard("last7"), fetchDashboard("last30")]);
		expect(load).toHaveBeenCalledTimes(2);
	});

	it("serves a fresh view without refetching, and forgets it when reset", async () => {
		load.mockResolvedValue(view());
		await fetchDashboard("last7");
		expect(freshDashboard("last7")).not.toBeNull();
		resetDashboardCache();
		expect(freshDashboard("last7")).toBeNull();
	});

	it("caches nothing after a failure, so a remount retries", async () => {
		load.mockRejectedValueOnce(new Error("boom"));
		await expect(fetchDashboard("last7")).rejects.toThrow("boom");
		expect(freshDashboard("last7")).toBeNull();
		load.mockResolvedValue(view());
		await expect(fetchDashboard("last7")).resolves.toBeTruthy();
	});

	it("ages a cached view out of the freshness window", async () => {
		vi.useFakeTimers();
		try {
			load.mockResolvedValue(view());
			await fetchDashboard("last7");
			vi.advanceTimersByTime(30_001);
			expect(freshDashboard("last7")).toBeNull();
		} finally {
			vi.useRealTimers();
		}
	});
});
