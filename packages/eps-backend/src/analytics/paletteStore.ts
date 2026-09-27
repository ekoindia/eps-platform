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
}

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
	insert(row: Omit<PaletteRow, "id">): void;
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

const COLUMNS = `id, ts, query, scope,
	result_count AS resultCount, outcome,
	clicked_category AS clickedCategory, clicked_rank AS clickedRank`;

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

	const insert = db.prepare(
		`INSERT INTO palette_query
			(ts, query, scope, result_count, outcome, clicked_category, clicked_rank)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
	);

	return {
		insert(row) {
			insert.run(
				row.ts,
				row.query,
				row.scope,
				row.resultCount,
				row.outcome,
				row.clickedCategory,
				row.clickedRank,
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
				.map((r) => ({ ...r }) as unknown as PaletteRow);
		},

		*exportRows(filter) {
			const w = whereClause(filter);
			const stmt = db.prepare(
				`SELECT ${COLUMNS} FROM palette_query ${w.sql} ORDER BY id`,
			);
			for (const r of stmt.iterate(...w.params)) {
				yield { ...r } as unknown as PaletteRow;
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
			if (removed) console.log(`[eps-backend] purged ${removed} search-log rows`);
		} catch (err) {
			console.error("[eps-backend] search-log purge failed", err);
		}
	};
	purge();
	const timer = setInterval(purge, DAY_MS);
	timer.unref?.();
	return () => clearInterval(timer);
}
