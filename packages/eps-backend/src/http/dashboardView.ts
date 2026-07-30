import type { DatePreset } from "./dashboardRange";

/**
 * A number and what it was in the preceding window of the same length.
 * `lastPeriod` is upstream's own comparison, not one computed here.
 */
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

/** One service's success ratio. The percentage is left to the caller. */
export interface ServiceSuccess {
	typeId: string;
	name: string;
	successCount: number;
	totalCount: number;
}

/** One bucket of the usage-over-time series. Granularity is upstream's choice. */
export interface UsagePoint {
	startDate: string;
	endDate: string;
	totalCount: number;
}

/** A `tx_typeid` and its human name, from interaction 1044. */
export interface ServiceRef {
	typeId: string;
	label: string;
}

/**
 * Everything the console's dashboard renders, in one already-normalized shape.
 *
 * `transactions` leads `overview` deliberately: an EPS partner is billed per API
 * call, so call volume is the headline and GTV is context. That is the opposite
 * of Eloka's ordering, where GTV leads.
 */
export interface DashboardView {
	range: { preset: DatePreset; from: string; to: string };
	overview: {
		transactions: DashboardMetric;
		successCases: DashboardMetric;
		failedCases: DashboardMetric;
		/** Upstream's `raCases` — response-awaited, i.e. pending. */
		pending: DashboardMetric;
		gtv: DashboardMetric;
		revenue: DashboardMetric;
		averageRevenue: DashboardMetric;
		/** Per-service split of GTV, richest first. */
		breakdown: ServiceAmount[];
	};
	successRates: ServiceSuccess[];
	mostUsedServices: ServiceCount[];
	usage: UsagePoint[];
	/** The 1044 master list. Empty when that call failed; names then degrade. */
	services: ServiceRef[];
}

/**
 * Where each dataset lands in the response.
 *
 * Upstream is not symmetric: the REQUEST keys are all snake_case, but only
 * `products_overview` comes back that way — the other three come back camelCase.
 * Stated once, here, so no reader has to rediscover it.
 */
export const REQUEST_KEYS = {
	overview: "products_overview",
	successRates: "success_rate",
	mostUsedServices: "most_used_services",
	usage: "verification_trends",
} as const;

const RESPONSE_KEYS = {
	overview: "products_overview",
	successRates: "successRate",
	mostUsedServices: "mostUsedServices",
	usage: "verificationTrends",
} as const;

/**
 * Coerces an upstream numeric field, which may arrive as a numeric string.
 * Mirrors `num` in `clients/eko.ts` — same reasoning, different boundary.
 * @param value - Anything upstream sent.
 * @returns A finite number; 0 for anything unusable.
 */
function num(value: unknown): number {
	const n = Number(value ?? 0);
	return Number.isFinite(n) ? n : 0;
}

/** Reads a nested record, or an empty one when the block is absent. */
function block(source: unknown, key: string): Record<string, unknown> {
	const value = (source as Record<string, unknown> | undefined)?.[key];
	return value && typeof value === "object"
		? (value as Record<string, unknown>)
		: {};
}

/**
 * Builds a metric from a block whose current-value field is named per-metric and
 * whose previous-value field is `lastPeriod`.
 */
function metric(
	source: unknown,
	key: string,
	valueField: string,
): DashboardMetric {
	const b = block(source, key);
	return { value: num(b[valueField]), lastPeriod: num(b.lastPeriod) };
}

/**
 * Resolves a `tx_typeid` to a human name.
 *
 * Falls back to `Service <id>` rather than a blank — Eloka's Success Rate widget
 * renders an empty label for an unmatched id, which reads as a broken row.
 */
function nameOf(names: Map<string, string>, typeId: string): string {
	return names.get(typeId) ?? `Service ${typeId}`;
}

/**
 * Parses the per-service GTV split.
 *
 * `typeBreakdown` arrives as an object on some accounts and as a JSON-encoded
 * STRING on others, so both are handled; malformed JSON yields an empty split
 * rather than throwing, because one bad field must not cost the whole dashboard.
 * @param raw - The `gtv.typeBreakdown` field.
 * @param names - The 1044 name map.
 * @returns Per-service amounts, largest first.
 */
function parseBreakdown(
	raw: unknown,
	names: Map<string, string>,
): ServiceAmount[] {
	let source: unknown = raw;
	if (typeof raw === "string") {
		try {
			source = JSON.parse(raw);
		} catch {
			return [];
		}
	}
	if (!source || typeof source !== "object") return [];
	return Object.entries(source as Record<string, unknown>)
		.map(([typeId, entry]) => {
			const e = (entry ?? {}) as Record<string, unknown>;
			// Upstream carries its own `name` here; prefer it over the 1044 join,
			// then fall back to the join, then to `Service <id>`.
			const name =
				typeof e.name === "string" && e.name.trim() !== ""
					? e.name.trim()
					: nameOf(names, typeId);
			return { typeId, name, amount: num(e.amount) };
		})
		.sort((a, b) => b.amount - a.amount);
}

/** Turns a `{ "<typeId>": {...} }` map into a sorted array, dropping junk entries. */
function fromServiceMap<T>(
	source: unknown,
	map: (typeId: string, entry: Record<string, unknown>) => T,
	sortBy: (row: T) => number,
): T[] {
	if (!source || typeof source !== "object") return [];
	return Object.entries(source as Record<string, unknown>)
		.map(([typeId, entry]) =>
			map(typeId, (entry ?? {}) as Record<string, unknown>),
		)
		.sort((a, b) => sortBy(b) - sortBy(a));
}

/**
 * Reads the service master list from an interaction-1044 envelope.
 *
 * The list sits at the TOP level (`param_attributes.list_elements`), not under
 * `data` like every dashboard payload — confirmed against Eloka's
 * `BusinessDashboard.tsx`.
 * @param envelope - The parsed 1044 response.
 * @returns Every service with a usable id; an empty list when the shape is wrong.
 */
export function parseServiceList(envelope: unknown): ServiceRef[] {
	const list = (
		envelope as { param_attributes?: { list_elements?: unknown } } | undefined
	)?.param_attributes?.list_elements;
	if (!Array.isArray(list)) return [];
	return list
		.map((entry) => {
			const e = (entry ?? {}) as Record<string, unknown>;
			return {
				typeId: String(e.tx_typeid ?? "").trim(),
				label: String(e.label ?? "").trim(),
			};
		})
		.filter((s) => s.typeId !== "" && s.label !== "");
}

/**
 * Normalizes one interaction-682 `dashboard_object` into the console's view.
 *
 * Everything upstream-shaped stops here: the snake/camel asymmetry, the
 * object-or-string `typeBreakdown`, numeric strings, and absent blocks. The
 * browser gets one shape and never does an id-to-name lookup.
 *
 * The agent-network fields (`activeAgents`, `onboardedAgents`, `commissionDue`)
 * are dropped at this boundary rather than carried and ignored: an EPS partner
 * has no downline, so surfacing them would only invite someone to render a
 * number that is structurally meaningless here.
 *
 * @param input - The window, the raw `dashboard_object`, and the 1044 list.
 * @returns The view, plus which datasets were ABSENT (as opposed to present and
 *   zero) — the caller logs those, because telling the two apart is what will
 *   diagnose an upstream contract change or a scope that cannot see this account.
 */
export function buildDashboardView(input: {
	preset: DatePreset;
	range: { datefrom: string; dateto: string };
	dashboardObject: unknown;
	services: ServiceRef[];
}): { view: DashboardView; absent: string[] } {
	const { dashboardObject, services } = input;
	const names = new Map(services.map((s) => [s.typeId, s.label]));
	const root = (dashboardObject ?? {}) as Record<string, unknown>;

	const absent = Object.values(RESPONSE_KEYS).filter(
		(key) => root[key] === undefined || root[key] === null,
	);

	const overview = root[RESPONSE_KEYS.overview];
	const gtv = block(overview, "gtv");

	const view: DashboardView = {
		range: {
			preset: input.preset,
			from: input.range.datefrom,
			to: input.range.dateto,
		},
		overview: {
			transactions: metric(overview, "transactions", "transactions"),
			successCases: metric(overview, "successCases", "successCases"),
			failedCases: metric(overview, "failedCases", "failedCases"),
			pending: metric(overview, "raCases", "raCases"),
			gtv: { value: num(gtv.amount), lastPeriod: num(gtv.lastPeriod) },
			revenue: {
				value: num(gtv.revenue),
				// Upstream really does spell this one with a lowercase `l`.
				lastPeriod: num(gtv.revenuelastPeriod),
			},
			averageRevenue: {
				value: num(gtv.averageRevenue),
				lastPeriod: num(gtv.averageRevenueLastPeriod),
			},
			breakdown: parseBreakdown(gtv.typeBreakdown, names),
		},
		successRates: fromServiceMap(
			root[RESPONSE_KEYS.successRates],
			(typeId, e) => ({
				typeId,
				name: nameOf(names, typeId),
				successCount: num(e.successCount),
				totalCount: num(e.totalCount),
			}),
			(row) => row.totalCount,
		),
		mostUsedServices: fromServiceMap(
			root[RESPONSE_KEYS.mostUsedServices],
			(typeId, e) => ({
				typeId,
				name: nameOf(names, typeId),
				totalCount: num(e.totalCount),
				// Optional upstream — Eloka types it as "in case revenue is added later".
				totalRevenue: num(e.totalRevenue),
			}),
			(row) => row.totalCount,
		),
		usage: Array.isArray(root[RESPONSE_KEYS.usage])
			? (root[RESPONSE_KEYS.usage] as unknown[]).map((entry) => {
					const e = (entry ?? {}) as Record<string, unknown>;
					return {
						startDate: String(e.startDate ?? ""),
						endDate: String(e.endDate ?? ""),
						totalCount: num(e.totalCount),
					};
				})
			: [],
		services,
	};

	return { view, absent };
}
