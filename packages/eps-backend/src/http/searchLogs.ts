import type { Context, Hono } from "hono";
import type {
	PaletteFilter,
	PaletteOutcome,
	PaletteRow,
	PaletteStore,
} from "../analytics/paletteStore";
import type { Sessions } from "../auth/session";
import { AppError } from "./errors";
import type { AppEnv } from "./requestId";
import { requireAdminSession } from "./session-guards";

/** Rows in each top-queries table. */
export const TOP_QUERIES_LIMIT = 25;
/** Default and maximum page size for the log browser. */
const PAGE_DEFAULT = 50;
const PAGE_MAX = 200;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const SLUG = /^[a-z]{1,20}$/;
const OUTCOMES = new Set<PaletteOutcome>(["click", "ask_ai", "abandon"]);

const bad = (field: string) =>
	new AppError(400, "INVALID_INPUT", `Invalid search-log filter: ${field}`);

/** `YYYY-MM-DD` → ISO midnight UTC, validated as a real calendar day. */
function dayStart(day: string, field: string): Date {
	const d = new Date(`${day}T00:00:00.000Z`);
	if (!DAY.test(day) || Number.isNaN(d.getTime())) throw bad(field);
	return d;
}

/**
 * Reads the shared filter from the query string. Dates are whole UTC days and
 * `to` is inclusive, which is how a date-range picker reads.
 * ponytail: UTC days; an IST-evening search lands on the next day. Take a
 * `tz` param if that ever matters in the charts.
 * @throws AppError 400 INVALID_INPUT naming the bad field.
 */
export function parseFilter(c: Context<AppEnv>): PaletteFilter {
	const { from, to, q, outcome, scope } = c.req.query();
	const filter: PaletteFilter = {};
	if (from) filter.from = dayStart(from, "from").toISOString();
	if (to) {
		const end = dayStart(to, "to");
		end.setUTCDate(end.getUTCDate() + 1);
		filter.to = end.toISOString();
	}
	if (q) {
		if (q.length > 100) throw bad("q");
		filter.q = q;
	}
	if (outcome) {
		if (!OUTCOMES.has(outcome as PaletteOutcome)) throw bad("outcome");
		filter.outcome = outcome as PaletteOutcome;
	}
	if (scope) {
		if (!SLUG.test(scope)) throw bad("scope");
		filter.scope = scope;
	}
	return filter;
}

const CSV_HEADER =
	"id,ts,query,scope,resultCount,outcome,clickedCategory,clickedRank\n";

/**
 * One CSV field. Query text is visitor-typed, so a leading `=`, `+`, `-` or `@`
 * is defused with a quote — otherwise opening the export in a spreadsheet would
 * run it as a formula.
 */
function csvField(value: string | number | null): string {
	if (value === null) return "";
	let s = String(value);
	if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
	return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Serialises one row as a CSV line. */
export function csvLine(r: PaletteRow): string {
	return `${[
		r.id,
		r.ts,
		r.query,
		r.scope,
		r.resultCount,
		r.outcome,
		r.clickedCategory,
		r.clickedRank,
	]
		.map(csvField)
		.join(",")}\n`;
}

/**
 * Mounts the admin search-log reads under `/admin/search-logs`. Admin session
 * only (no GitHub token needed); every response is `no-store` because it is
 * visitor-typed text behind a login.
 * @param app - The BFF app.
 * @param deps.sessions - Verifies the admin access cookie.
 * @param deps.store - The search-log store.
 */
export function mountSearchLogs(
	app: Hono<AppEnv>,
	deps: { sessions: Sessions; store: PaletteStore },
): void {
	const { sessions, store } = deps;

	app.use("/admin/search-logs/*", async (c, next) => {
		await requireAdminSession(sessions, c);
		await next();
		c.res.headers.set("cache-control", "no-store");
	});

	// Summary cards + both top tables in one round trip: they share a filter
	// and the page always shows them together.
	app.get("/admin/search-logs/overview", (c) => {
		const filter = parseFilter(c);
		return c.json({
			summary: store.summary(filter),
			top: store.topQueries(filter, {
				failing: false,
				limit: TOP_QUERIES_LIMIT,
			}),
			topFailing: store.topQueries(filter, {
				failing: true,
				limit: TOP_QUERIES_LIMIT,
			}),
		});
	});

	app.get("/admin/search-logs/rows", (c) => {
		const filter = parseFilter(c);
		const { before, limit } = c.req.query();
		const beforeId = before === undefined ? undefined : Number(before);
		if (beforeId !== undefined && !(Number.isInteger(beforeId) && beforeId > 0))
			throw bad("before");
		const size = limit === undefined ? PAGE_DEFAULT : Number(limit);
		if (!(Number.isInteger(size) && size > 0 && size <= PAGE_MAX))
			throw bad("limit");
		const rows = store.rows(filter, { beforeId, limit: size });
		return c.json({
			rows,
			// A full page may have more behind it; a short one cannot.
			nextBefore: rows.length === size ? rows[rows.length - 1].id : null,
		});
	});

	// Streamed so a year of rows never sits in memory as one string.
	app.get("/admin/search-logs/export", (c) => {
		const filter = parseFilter(c);
		const format = c.req.query("format") ?? "jsonl";
		if (format !== "jsonl" && format !== "csv") throw bad("format");
		const rows = store.exportRows(filter)[Symbol.iterator]();
		const encoder = new TextEncoder();
		let headerSent = format !== "csv";
		const body = new ReadableStream<Uint8Array>({
			pull(controller) {
				if (!headerSent) {
					headerSent = true;
					controller.enqueue(encoder.encode(CSV_HEADER));
					return;
				}
				const next = rows.next();
				if (next.done) {
					controller.close();
					return;
				}
				controller.enqueue(
					encoder.encode(
						format === "csv"
							? csvLine(next.value)
							: `${JSON.stringify(next.value)}\n`,
					),
				);
			},
		});
		const stamp = new Date().toISOString().slice(0, 10);
		return c.body(body, 200, {
			"content-type":
				format === "csv"
					? "text/csv; charset=utf-8"
					: "application/x-ndjson; charset=utf-8",
			"content-disposition": `attachment; filename="search-logs-${stamp}.${format}"`,
		});
	});
}
