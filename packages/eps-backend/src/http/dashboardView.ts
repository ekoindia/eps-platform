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
 * The four datasets, and how upstream names each one going out and coming back.
 *
 * Upstream is not symmetric: the REQUEST keys are all snake_case, but only
 * `products_overview` comes back that way — the other three come back camelCase.
 * Stated once, here, so no reader has to rediscover it.
 *
 * `perService` marks the two datasets a `typeid` filter is meaningful on;
 * upstream takes dates alone for the other two.
 */
export const DATASETS = [
	{
		request: "products_overview",
		response: "products_overview",
		perService: true,
	},
	{
		request: "most_used_services",
		response: "mostUsedServices",
		perService: true,
	},
	{ request: "success_rate", response: "successRate", perService: false },
	{
		request: "verification_trends",
		response: "verificationTrends",
		perService: false,
	},
] as const;

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
 * Unwraps a block that upstream sometimes JSON-encodes.
 *
 * `typeBreakdown` demonstrably arrives as an object on some accounts and as a
 * JSON STRING on others, and nothing says the other blocks are exempt — so every
 * block goes through here. Malformed JSON yields `undefined` rather than
 * throwing: one bad field must not cost the whole dashboard.
 * @param raw - Whatever upstream sent for that block.
 * @returns The decoded value, or `undefined` when it cannot be decoded.
 */
function decode(raw: unknown): unknown {
	if (typeof raw !== "string") return raw;
	try {
		return JSON.parse(raw);
	} catch {
		return undefined;
	}
}

/**
 * Parses the per-service GTV split.
 * @param raw - The `gtv.typeBreakdown` field, object or JSON string.
 * @param names - The 1044 name map.
 * @returns Per-service amounts, largest first.
 */
function parseBreakdown(
	raw: unknown,
	names: Map<string, string>,
): ServiceAmount[] {
	const source = decode(raw);
	if (!source || typeof source !== "object" || Array.isArray(source)) return [];
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

/**
 * Turns a `{ "<typeId>": {...} }` map into a sorted array, dropping junk entries.
 *
 * An ARRAY is rejected rather than accepted: `Object.entries` would hand back
 * "0", "1", "2" as service ids and the view would render three rows named
 * `Service 0` — worse than empty, because it looks like data. If upstream ever
 * sends one, the shape log below is what says so.
 */
function fromServiceMap<T>(
	raw: unknown,
	map: (typeId: string, entry: Record<string, unknown>) => T,
	sortBy: (row: T) => number,
): T[] {
	const source = decode(raw);
	if (!source || typeof source !== "object" || Array.isArray(source)) return [];
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

/** Lowercased, separator-free form of a key, for tolerant matching. */
function normalizeKey(key: string): string {
	return key.replace(/[_-]/g, "").toLowerCase();
}

/**
 * Finds one dataset inside a `dashboard_object`, tolerating a renamed key.
 *
 * Upstream's naming is already inconsistent — three of the four datasets convert
 * snake to camel on the way back and one does not — so a block arriving as
 * `verification_trends` rather than `verificationTrends` is a live possibility,
 * and it would otherwise present as a silently blank widget.
 *
 * EXACT candidates are tried first, in order, before any normalized matching:
 * an exact hit on the request name must never lose to a fuzzy hit on the
 * response name. A normalized match that is AMBIGUOUS — two raw keys collapsing
 * to the same normalized form — resolves to `undefined` rather than to whichever
 * key upstream happened to serialize first; the caller logs the raw key set, so
 * the ambiguity is visible instead of arbitrary.
 * @param root - The `dashboard_object` (or anything, if upstream sent junk).
 * @param candidates - Accepted names, most authoritative first.
 * @returns The block, or `undefined` when absent or ambiguous.
 */
export function pickDataset(root: unknown, ...candidates: string[]): unknown {
	const source = decode(root);
	if (!source || typeof source !== "object" || Array.isArray(source)) {
		return undefined;
	}
	const record = source as Record<string, unknown>;
	for (const candidate of candidates) {
		if (record[candidate] !== undefined) return record[candidate];
	}
	const wanted = new Set(candidates.map(normalizeKey));
	const matches = Object.keys(record).filter((key) =>
		wanted.has(normalizeKey(key)),
	);
	return matches.length === 1 ? record[matches[0]] : undefined;
}

/**
 * Describes the SHAPE of a `dashboard_object`, for the log.
 *
 * Keys and kinds only, never values: a real body is one partner's revenue and
 * service mix, which does not belong in a log line. This is the one thing that
 * can tell an upstream contract change ("the key isn't there") from an
 * encoding surprise ("it's a string") from a quiet week ("it's an empty map"),
 * and none of those are distinguishable from the rendered view.
 *
 * Kinds are reported AFTER `decode`, so a JSON-encoded block reads as
 * `verificationTrends:string→array[12]` rather than just `string`.
 * @param dashboardObject - The raw block from upstream.
 * @returns A one-line `key:kind, key:kind` summary.
 */
export function shapeOf(dashboardObject: unknown): string {
	if (!dashboardObject || typeof dashboardObject !== "object") {
		return `<${dashboardObject === null ? "null" : typeof dashboardObject}>`;
	}
	const kind = (value: unknown): string => {
		if (value === null) return "null";
		if (Array.isArray(value)) return `array[${value.length}]`;
		if (typeof value === "object") {
			return `object{${Object.keys(value as object).length}}`;
		}
		return typeof value;
	};
	return Object.entries(dashboardObject as Record<string, unknown>)
		.map(([key, value]) => {
			if (typeof value !== "string") return `${key}:${kind(value)}`;
			const decoded = decode(value);
			return `${key}:string→${decoded === undefined ? "unparseable" : kind(decoded)}`;
		})
		.join(", ");
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
	/** The active single-service filter, so the Most-Used fallback can honour it. */
	typeId?: string;
}): { view: DashboardView; absent: string[] } {
	const { dashboardObject, services } = input;
	const names = new Map(services.map((s) => [s.typeId, s.label]));
	const root = (dashboardObject ?? {}) as Record<string, unknown>;

	const absent = Object.values(RESPONSE_KEYS).filter(
		(key) => root[key] === undefined || root[key] === null,
	);

	const overview = decode(root[RESPONSE_KEYS.overview]);
	const gtv = block(overview, "gtv");

	const successRates = fromServiceMap(
		root[RESPONSE_KEYS.successRates],
		(typeId, e) => ({
			typeId,
			name: nameOf(names, typeId),
			successCount: num(e.successCount),
			totalCount: num(e.totalCount),
		}),
		(row) => row.totalCount,
	);

	const mostUsed = fromServiceMap(
		root[RESPONSE_KEYS.mostUsedServices],
		(typeId, e) => ({
			typeId,
			name: nameOf(names, typeId),
			totalCount: num(e.totalCount),
			// Optional upstream — Eloka types it as "in case revenue is added later".
			totalRevenue: num(e.totalRevenue),
		}),
		(row) => row.totalCount,
	);

	// FALLBACK, not a second source of truth: upstream returns `mostUsedServices`
	// empty for this account while `successRate` carries a `totalCount` per
	// service — which is the same per-service call volume this widget charts. It is
	// an APPROXIMATION: if upstream ever scopes the two blocks differently (e.g.
	// success rates omitting a service with no successes), the counts drift. The
	// shape log says which one is being rendered; delete this once `mostUsedServices`
	// is reliable.
	//
	// `success_rate` is never sent `typeid` upstream, so the fallback is filtered
	// here — otherwise a service filter would show every service in this widget.
	const mostUsedServices =
		mostUsed.length > 0
			? mostUsed
			: successRates
					.filter((row) => !input.typeId || row.typeId === input.typeId)
					.map((row) => ({
						typeId: row.typeId,
						name: row.name,
						totalCount: row.totalCount,
						totalRevenue: 0,
					}));

	const usage = decode(root[RESPONSE_KEYS.usage]);

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
		successRates,
		mostUsedServices,
		usage: Array.isArray(usage)
			? (usage as unknown[])
					// A bucket with no `startDate` cannot be placed on an axis, so it is
					// dropped rather than rendered as a nameless bar. Upstream sends
					// date-only stamps here (`2026-07-28`), not the `T`-separated form
					// the other blocks use.
					.filter(
						(entry) =>
							typeof (entry as Record<string, unknown> | null)?.startDate ===
								"string" &&
							((entry as Record<string, string>).startDate ?? "").trim() !== "",
					)
					.map((entry) => {
						const e = entry as Record<string, unknown>;
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
