import { dashboardClient } from "@/lib/auth/client";

/** The windows the dashboard offers. Mirrors the backend's `DATE_PRESETS`. */
export type DatePreset = "today" | "yesterday" | "last7" | "last30" | "last365";

/**
 * The preset control, in display order.
 *
 * `last365` is Eloka's "Year Till Yesterday" relabelled: that range is a
 * trailing 365 days ending yesterday, not the calendar year to date, and the
 * label should say what the numbers actually cover.
 */
export const DASHBOARD_PRESETS: ReadonlyArray<{
	value: DatePreset;
	label: string;
}> = [
	{ value: "today", label: "Today" },
	{ value: "yesterday", label: "Yesterday" },
	{ value: "last7", label: "Last 7 Days" },
	{ value: "last30", label: "Last 30 Days" },
	{ value: "last365", label: "Last 365 Days" },
];

/** A number and what it was in the preceding window of the same length. */
export interface DashboardMetric {
	value: number;
	lastPeriod: number;
}

/** One service's share of a money total. */
export interface ServiceAmount {
	typeId: string;
	name: string;
	amount: number;
}

/** One service's call volume. */
export interface ServiceCount {
	typeId: string;
	name: string;
	totalCount: number;
	totalRevenue: number;
}

/** One service's success ratio. */
export interface ServiceSuccess {
	typeId: string;
	name: string;
	successCount: number;
	totalCount: number;
}

/** One bucket of the usage-over-time series. */
export interface UsagePoint {
	startDate: string;
	endDate: string;
	totalCount: number;
}

/** A service id and its human name, from the backend's 1044 join. */
export interface ServiceRef {
	typeId: string;
	label: string;
}

/** Everything the dashboard renders, already normalized by the backend. */
export interface DashboardView {
	range: { preset: DatePreset; from: string; to: string };
	overview: {
		transactions: DashboardMetric;
		successCases: DashboardMetric;
		failedCases: DashboardMetric;
		pending: DashboardMetric;
		gtv: DashboardMetric;
		revenue: DashboardMetric;
		averageRevenue: DashboardMetric;
		breakdown: ServiceAmount[];
	};
	successRates: ServiceSuccess[];
	mostUsedServices: ServiceCount[];
	usage: UsagePoint[];
	services: ServiceRef[];
}

/**
 * How long a fetched view is reused across mounts. Same reasoning — and same
 * window — as `src/lib/wallet-balance.ts`: `AnimatedRoutes` keys the route
 * subtree on the pathname, so every console navigation remounts the page and
 * would otherwise refetch and flash skeletons.
 */
export const FRESH_FOR_MS = 30_000;

interface CachedView {
	view: DashboardView;
	at: number;
}

// ponytail: in-memory, this tab, this session — cleared by AuthProvider when the
// session goes anon. The backend caches too (60s/900s), so this only saves the
// round-trip, not the upstream call.
const cache = new Map<string, CachedView>();
const inflight = new Map<string, Promise<DashboardView>>();

/** Cache key for one window. Must include every dimension the view depends on. */
function keyOf(preset: DatePreset, typeId?: string): string {
	return `${preset}:${typeId ?? "all"}`;
}

/** Drops every cached view. Called when the session ends, and by tests. */
export function resetDashboardCache(): void {
	cache.clear();
	inflight.clear();
}

/**
 * Fetches one window, sharing a request between concurrent callers.
 *
 * Only successes are cached: a transient failure caches nothing, so a remount
 * retries immediately rather than pinning an error for the rest of the window.
 * @param preset - The window to load.
 * @param typeId - Optional single-service filter.
 */
export function fetchDashboard(
	preset: DatePreset,
	typeId?: string,
): Promise<DashboardView> {
	const key = keyOf(preset, typeId);
	let pending = inflight.get(key);
	if (!pending) {
		pending = dashboardClient
			.load({ preset, typeId })
			.then((view) => {
				cache.set(key, { view, at: Date.now() });
				return view;
			})
			.finally(() => {
				inflight.delete(key);
			});
		inflight.set(key, pending);
	}
	return pending;
}

/** The cached view, or null once it has aged out of the freshness window. */
export function freshDashboard(
	preset: DatePreset,
	typeId?: string,
): DashboardView | null {
	const entry = cache.get(keyOf(preset, typeId));
	if (!entry) return null;
	return Date.now() - entry.at < FRESH_FOR_MS ? entry.view : null;
}

/**
 * The services worth offering in the filter dropdown.
 *
 * The 1044 master list is every service Eko sells, most of which a given partner
 * has never called — so the options are that list NARROWED to the ids this window
 * actually has data for, the way Eloka intersects it with the GTV breakdown. All
 * three datasets contribute: a verification API with ₹0 GTV is still a service
 * worth filtering by.
 *
 * Only ever call this with an UNFILTERED view. Under a filter the data shrinks to
 * one service, and recomputing would collapse the dropdown to the option already
 * selected — the trap Eloka works around with a sticky cached list.
 * @param view - An unfiltered dashboard view.
 * @returns Selectable services, by name.
 */
export function serviceOptions(view: DashboardView): ServiceRef[] {
	const labels = new Map(view.services.map((s) => [s.typeId, s.label]));
	const seen = new Map<string, string>();
	for (const row of [
		...view.overview.breakdown,
		...view.successRates,
		...view.mostUsedServices,
	]) {
		if (!seen.has(row.typeId)) {
			seen.set(row.typeId, labels.get(row.typeId) ?? row.name);
		}
	}
	return [...seen]
		.map(([typeId, label]) => ({ typeId, label }))
		.sort((a, b) => a.label.localeCompare(b.label));
}

export function successPct(successCount: number, totalCount: number): number {
	if (!totalCount) return 0;
	return (successCount / totalCount) * 100;
}

/**
 * Period-on-period change, for the delta chip.
 *
 * Port of Eloka's `calculateVariation`, with its judgement calls kept: a change
 * against a zero baseline is not a percentage (everything is "infinity up"), an
 * unchanged metric shows nothing rather than "0%", and anything past +100% reads
 * better as a multiple than as "+540%".
 * @returns null when there is nothing worth showing.
 */
export function deltaOf(
	metric: DashboardMetric,
): { label: string; up: boolean } | null {
	const { value, lastPeriod } = metric;
	if (!lastPeriod || !value || value === lastPeriod) return null;
	const change = ((value - lastPeriod) / lastPeriod) * 100;
	const up = change > 0;
	if (change > 100) return { label: `${(value / lastPeriod).toFixed(1)}X`, up };
	return { label: `${Math.abs(change).toFixed(1)}%`, up };
}

/**
 * Parses an upstream stamp as a LOCAL time, in either form upstream sends.
 *
 * Upstream mixes two: `2026-07-28 23:59:59` for windows, and a bare
 * `2026-07-28` for usage buckets. `new Date` treats those differently — the
 * space-separated form is local, the date-only form is ISO and therefore UTC —
 * so left alone, a partner west of UTC would see every usage bar labelled a day
 * earlier than the "Showing stats from…" line above it. Both are read as local
 * here, so one calendar day means one calendar day everywhere.
 * @param raw - `yyyy-MM-dd`, `yyyy-MM-dd HH:mm:ss` or `yyyy-MM-ddTHH:mm:ss`.
 */
function parseStamp(raw: string): Date {
	const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
	if (dateOnly) {
		const [, year, month, day] = dateOnly;
		return new Date(Number(year), Number(month) - 1, Number(day));
	}
	return new Date(raw.replace(" ", "T"));
}

/**
 * Whether the series is fine-grained enough to label by hour.
 *
 * Upstream picks the bucket size and does not announce it, so this infers it
 * from the first bucket's own span rather than from the preset — the same guess
 * Eloka makes, but made from the data instead of the request.
 */
export function isHourlyRange(usage: UsagePoint[]): boolean {
	const first = usage[0];
	if (!first) return false;
	const span =
		parseStamp(first.endDate).getTime() - parseStamp(first.startDate).getTime();
	return Number.isFinite(span) && span > 0 && span <= 3_600_000 * 2;
}

/**
 * X-axis label for one bucket: an hour when the series is hourly, else a date.
 * @param point - The bucket.
 * @param hourly - Whether the series is hourly, from `isHourlyRange`.
 */
export function formatBucketLabel(point: UsagePoint, hourly: boolean): string {
	const start = parseStamp(point.startDate);
	if (Number.isNaN(start.getTime())) return point.startDate;
	return hourly
		? start.toLocaleTimeString("en-IN", { hour: "numeric", hour12: true })
		: start.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** The usage series with a running total, ready to chart. */
export interface UsageSeriesPoint extends UsagePoint {
	label: string;
	cumulativeCount: number;
}

/** Headline numbers for the usage widget, plus the charting series. */
export interface UsageSummary {
	series: UsageSeriesPoint[];
	total: number;
	average: number;
	peak: number;
	peakLabel: string;
}

/**
 * Derives the usage headline figures and the cumulative series.
 *
 * Upstream sends per-bucket counts only; the running total, the average and the
 * peak are all computed here — the same division of labour Eloka uses.
 * @param usage - The buckets, chronological.
 */
export function summarizeUsage(usage: UsagePoint[]): UsageSummary {
	const hourly = isHourlyRange(usage);
	let running = 0;
	const series = usage.map((point) => {
		running += point.totalCount;
		return {
			...point,
			label: formatBucketLabel(point, hourly),
			cumulativeCount: running,
		};
	});
	const peakPoint = series.reduce<UsageSeriesPoint | null>(
		(best, point) =>
			!best || point.totalCount > best.totalCount ? point : best,
		null,
	);
	return {
		series,
		total: running,
		average: series.length ? Math.round(running / series.length) : 0,
		peak: peakPoint?.totalCount ?? 0,
		peakLabel: peakPoint?.label ?? "—",
	};
}

/** Formats one upstream `yyyy-MM-dd HH:mm:ss` stamp as a readable date. */
function formatDay(raw: string): string {
	const parsed = parseStamp(raw);
	if (Number.isNaN(parsed.getTime())) return raw;
	return parsed.toLocaleDateString("en-IN", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

/**
 * The "Showing stats…" line above the widgets.
 *
 * Says the actual dates rather than repeating the preset label, because the
 * presets are the part people misread — "Last 7 Days" ends YESTERDAY, and only
 * the dates make that visible.
 */
export function describeRange(range: DashboardView["range"]): string {
	const from = formatDay(range.from);
	const to = formatDay(range.to);
	return from === to
		? `Showing stats for ${from}`
		: `Showing stats from ${from} to ${to}`;
}
