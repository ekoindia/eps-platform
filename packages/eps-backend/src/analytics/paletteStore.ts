import { DatabaseSync, type SQLInputValue } from "node:sqlite";

/** How a ⌘K session with a query ended. */
export type PaletteOutcome = "click" | "ask_ai" | "abandon";

/** One stored palette session: the last query and what the visitor did with it. */
export interface PaletteRow {
	id: number;
	/** ISO-8601 UTC. */
	ts: string;
	/** Already redacted by the time it reaches the store. */
	query: string;
	scope: string;
	resultCount: number;
	outcome: PaletteOutcome;
	clickedCategory: string | null;
	clickedRank: number | null;
	// Context — null on rows written by site builds that predate it.
	/** Normalised page path the palette was opened on. */
	page: string | null;
	/** `anon` | `developer` | `signup` | `admin` | `unknown`. */
	auth: string | null;
	/** Developer lifecycle (`active`, `kyc-pending`…); null for everyone else. */
	stage: string | null;
	/** `keyboard` | `header_button` | `mobile_button`. */
	trigger: string | null;
	/** `mobile` | `desktop`. */
	device: string | null;
	/** Search item id of the clicked result, e.g. `endpoint:pan-verification`. */
	clickedId: string | null;
	/** The clicked result's title as the visitor saw it. */
	clickedLabel: string | null;
	/** Settled queries before the final one. */
	refinements: number | null;
	/** Milliseconds from palette open to outcome. */
	durationMs: number | null;
	/** Whether the long-form page-text index had loaded. */
	bodyIndexLoaded: boolean | null;
	/** Intent of the action card shown for the final query, if any. */
	actionIntent: string | null;
}

/** Context fields a row may lack: older site builds never send them. */
type ContextKey =
	| "page"
	| "auth"
	| "stage"
	| "trigger"
	| "device"
	| "clickedId"
	| "clickedLabel"
	| "refinements"
	| "durationMs"
	| "bodyIndexLoaded"
	| "actionIntent";

/** What `insert` takes: context fields optional, stored as null when absent. */
export type NewPaletteRow = Omit<PaletteRow, "id" | ContextKey> &
	Partial<Pick<PaletteRow, ContextKey>>;

/** Narrows every read. All fields optional; an empty filter means everything. */
export interface PaletteFilter {
	/** Inclusive ISO-8601 lower bound on `ts`. */
	from?: string;
	/** Exclusive ISO-8601 upper bound on `ts`. */
	to?: string;
	/** Case-insensitive substring of the query. */
	q?: string;
	outcome?: PaletteOutcome;
	scope?: string;
	auth?: string;
	stage?: string;
}

/** Counts behind the admin summary cards. */
export interface PaletteSummary {
	total: number;
	zeroResult: number;
	click: number;
	askAi: number;
	abandon: number;
}

/** A query and how many sessions ended on it. */
export interface QueryCount {
	query: string;
	count: number;
}

/** Search-log persistence; one SQLite file on the VM. */
export interface PaletteStore {
	/** False for `:memory:` — every row is lost on restart. Shown to admins. */
	readonly persistent: boolean;
	insert(row: NewPaletteRow): void;
	summary(filter: PaletteFilter): PaletteSummary;
	/**
	 * Most frequent queries, case- and whitespace-folded. `failing` keeps only
	 * sessions that found nothing or were abandoned — the synonym backlog.
	 */
	topQueries(
		filter: PaletteFilter,
		opts: { failing: boolean; limit: number },
	): QueryCount[];
	/** Newest first; pass the last row's id as `beforeId` for the next page. */
	rows(
		filter: PaletteFilter,
		opts: { beforeId?: number; limit: number },
	): PaletteRow[];
	/** Every matching row, oldest first, read lazily for streaming export. */
	exportRows(filter: PaletteFilter): Iterable<PaletteRow>;
	/** Deletes rows older than `ts`; returns how many went. */
	purgeBefore(ts: string): number;
	close(): void;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS palette_query (
	id               INTEGER PRIMARY KEY,
	ts               TEXT    NOT NULL,
	query            TEXT    NOT NULL,
	scope            TEXT    NOT NULL,
	result_count     INTEGER NOT NULL,
	outcome          TEXT    NOT NULL,
	clicked_category TEXT,
	clicked_rank     INTEGER
);
CREATE INDEX IF NOT EXISTS palette_query_ts ON palette_query (ts);
`;

/**
 * Columns added after the first release, as [name, type]. `openPaletteStore`
 * adds whichever an existing file lacks, so a database written by an older
 * backend upgrades in place; old rows read these as null. Append only.
 */
const ADDED_COLUMNS: readonly [string, string][] = [
	["page", "TEXT"],
	["auth", "TEXT"],
	["stage", "TEXT"],
	["trigger", "TEXT"],
	["device", "TEXT"],
	["clicked_id", "TEXT"],
	["clicked_label", "TEXT"],
	["refinements", "INTEGER"],
	["duration_ms", "INTEGER"],
	["body_index_loaded", "INTEGER"],
	["action_intent", "TEXT"],
];

const COLUMNS = `id, ts, query, scope,
	result_count AS resultCount, outcome,
	clicked_category AS clickedCategory, clicked_rank AS clickedRank,
	page, auth, stage, trigger, device,
	clicked_id AS clickedId, clicked_label AS clickedLabel,
	refinements, duration_ms AS durationMs,
	body_index_loaded AS bodyIndexLoaded,
	action_intent AS actionIntent`;

/** SQLite has no boolean: 0/1/null back to boolean/null, and a plain object. */
const toRow = (r: Record<string, unknown>): PaletteRow =>
	({
		...r,
		bodyIndexLoaded:
			r.bodyIndexLoaded === null ? null : r.bodyIndexLoaded === 1,
	}) as unknown as PaletteRow;

/** Escapes LIKE wildcards so a typed `%` or `_` matches itself. */
const likeLiteral = (s: string): string => s.replace(/[\\%_]/g, "\\$&");

/**
 * Builds the WHERE clause shared by every read, so the summary cards, the top
 * tables, the browser and the export can never disagree about what a filter
 * means.
 * @param filter - The admin's current filter.
 * @param extra - Additional conditions (already parameterised) to AND in.
 * @returns SQL fragment (possibly empty) and its positional parameters.
 */
export function whereClause(
	filter: PaletteFilter,
	extra: { sql: string; params: SQLInputValue[] }[] = [],
): { sql: string; params: SQLInputValue[] } {
	const parts: { sql: string; params: SQLInputValue[] }[] = [];
	if (filter.from) parts.push({ sql: "ts >= ?", params: [filter.from] });
	if (filter.to) parts.push({ sql: "ts < ?", params: [filter.to] });
	if (filter.q)
		parts.push({
			sql: "query LIKE ? ESCAPE '\\'",
			params: [`%${likeLiteral(filter.q)}%`],
		});
	if (filter.outcome)
		parts.push({ sql: "outcome = ?", params: [filter.outcome] });
	if (filter.scope) parts.push({ sql: "scope = ?", params: [filter.scope] });
	if (filter.auth) parts.push({ sql: "auth = ?", params: [filter.auth] });
	if (filter.stage) parts.push({ sql: "stage = ?", params: [filter.stage] });
	const all = [...parts, ...extra];
	return all.length
		? {
				sql: `WHERE ${all.map((p) => `(${p.sql})`).join(" AND ")}`,
				params: all.flatMap((p) => p.params),
			}
		: { sql: "", params: [] };
}

/**
 * Opens (creating if needed) the search-log database.
 *
 * WAL mode lets the admin export read while the telemetry route writes. The
 * backend is a single process on one VM, which is the one writer SQLite wants.
 * ponytail: single-file SQLite; move to Postgres if the backend ever runs as
 * more than one instance.
 * @param path - File path, or `:memory:` for tests and local dev.
 */
export function openPaletteStore(path: string): PaletteStore {
	const db = new DatabaseSync(path);
	db.exec("PRAGMA journal_mode = WAL;");
	db.exec(SCHEMA);
	const existing = new Set(
		db
			.prepare("PRAGMA table_info(palette_query)")
			.all()
			.map((c) => String(c.name)),
	);
	for (const [name, type] of ADDED_COLUMNS) {
		if (!existing.has(name))
			db.exec(`ALTER TABLE palette_query ADD COLUMN ${name} ${type}`);
	}

	const insert = db.prepare(
		`INSERT INTO palette_query
			(ts, query, scope, result_count, outcome, clicked_category, clicked_rank,
			 page, auth, stage, trigger, device, clicked_id, clicked_label,
			 refinements, duration_ms, body_index_loaded, action_intent)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	);

	return {
		persistent: path !== ":memory:",
		insert(row) {
			insert.run(
				row.ts,
				row.query,
				row.scope,
				row.resultCount,
				row.outcome,
				row.clickedCategory,
				row.clickedRank,
				row.page ?? null,
				row.auth ?? null,
				row.stage ?? null,
				row.trigger ?? null,
				row.device ?? null,
				row.clickedId ?? null,
				row.clickedLabel ?? null,
				row.refinements ?? null,
				row.durationMs ?? null,
				row.bodyIndexLoaded == null ? null : row.bodyIndexLoaded ? 1 : 0,
				row.actionIntent ?? null,
			);
		},

		summary(filter) {
			const w = whereClause(filter);
			const r = db
				.prepare(
					`SELECT count(*) AS total,
						coalesce(sum(result_count = 0), 0)       AS zeroResult,
						coalesce(sum(outcome = 'click'), 0)      AS click,
						coalesce(sum(outcome = 'ask_ai'), 0)     AS askAi,
						coalesce(sum(outcome = 'abandon'), 0)    AS abandon
					 FROM palette_query ${w.sql}`,
				)
				.get(...w.params) as unknown as PaletteSummary;
			return { ...r };
		},

		topQueries(filter, { failing, limit }) {
			const w = whereClause(
				filter,
				failing
					? [{ sql: "result_count = 0 OR outcome = 'abandon'", params: [] }]
					: [],
			);
			return db
				.prepare(
					`SELECT lower(trim(query)) AS query, count(*) AS count
					 FROM palette_query ${w.sql}
					 GROUP BY 1 ORDER BY count DESC, query LIMIT ?`,
				)
				.all(...w.params, limit)
				.map((r) => ({ ...r }) as unknown as QueryCount);
		},

		rows(filter, { beforeId, limit }) {
			const w = whereClause(
				filter,
				beforeId === undefined ? [] : [{ sql: "id < ?", params: [beforeId] }],
			);
			return db
				.prepare(
					`SELECT ${COLUMNS} FROM palette_query ${w.sql}
					 ORDER BY id DESC LIMIT ?`,
				)
				.all(...w.params, limit)
				.map(toRow);
		},

		*exportRows(filter) {
			const w = whereClause(filter);
			const stmt = db.prepare(
				`SELECT ${COLUMNS} FROM palette_query ${w.sql} ORDER BY id`,
			);
			for (const r of stmt.iterate(...w.params)) {
				yield toRow(r);
			}
		},

		purgeBefore(ts) {
			return Number(
				db.prepare("DELETE FROM palette_query WHERE ts < ?").run(ts).changes,
			);
		},

		close() {
			db.close();
		},
	};
}

/** Search logs older than this are deleted; the privacy policy promises 12 months. */
export const RETENTION_DAYS = 365;
const DAY_MS = 86_400_000;

/**
 * Purges rows past retention now and then once a day. The timer is unref'd so
 * it never holds the process open.
 * @param store - The search-log store.
 * @param now - Clock; injectable for tests.
 * @returns Stops the schedule.
 */
export function scheduleRetention(
	store: PaletteStore,
	now: () => number = Date.now,
): () => void {
	const purge = () => {
		try {
			const removed = store.purgeBefore(
				new Date(now() - RETENTION_DAYS * DAY_MS).toISOString(),
			);
			if (removed)
				console.log(`[eps-backend] purged ${removed} search-log rows`);
		} catch (err) {
			console.error("[eps-backend] search-log purge failed", err);
		}
	};
	purge();
	const timer = setInterval(purge, DAY_MS);
	timer.unref?.();
	return () => clearInterval(timer);
}
