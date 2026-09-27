import type { Hono } from "hono";
import type { PaletteOutcome, PaletteStore } from "../analytics/paletteStore";
import { redactIdentifiers } from "../audit/redact";
import type { KV } from "../store/kv";
import { AppError } from "./errors";
import { enforceRateLimit, RL_WINDOW_SEC } from "./rateLimit";
import type { AppEnv } from "./requestId";

/** Per-`x-real-ip` reports per `RL_WINDOW_SEC`. One report per palette session, so generous. */
export const PALETTE_IP_LIMIT = 60;
/** Query text cap; the site truncates to the same length before sending. */
export const PALETTE_MAX_QUERY_CHARS = 200;
/** Whole-body cap: a report is a handful of short fields. */
const MAX_BODY_CHARS = 2048;

const OUTCOMES = new Set(["click", "ask_ai", "abandon"]);
/** Search scope and result category ids are short lowercase slugs. */
const SLUG = /^[a-z]{1,20}$/;

/** A validated palette report, before redaction and stamping. */
export interface PaletteReport {
	query: string;
	scope: string;
	resultCount: number;
	outcome: PaletteOutcome;
	clickedCategory: string | null;
	clickedRank: number | null;
}

const isCount = (v: unknown, max: number): v is number =>
	Number.isInteger(v) && (v as number) >= 0 && (v as number) <= max;

/**
 * Validates a palette report body. Unknown keys are ignored rather than
 * rejected: an older site build may still send a field this version dropped.
 * @param raw - The parsed JSON body.
 * @returns The report with optional click fields normalised to null.
 * @throws AppError 400 BAD_REQUEST naming the first invalid field.
 */
export function parsePaletteReport(raw: unknown): PaletteReport {
	const bad = (field: string) =>
		new AppError(400, "BAD_REQUEST", `Invalid palette report: ${field}`);
	if (typeof raw !== "object" || raw === null) throw bad("body");
	const r = raw as Record<string, unknown>;

	if (
		typeof r.query !== "string" ||
		!r.query.trim() ||
		r.query.length > PALETTE_MAX_QUERY_CHARS
	)
		throw bad("query");
	if (typeof r.scope !== "string" || !SLUG.test(r.scope)) throw bad("scope");
	if (!isCount(r.resultCount, 1000)) throw bad("resultCount");
	if (typeof r.outcome !== "string" || !OUTCOMES.has(r.outcome))
		throw bad("outcome");
	if (
		r.clickedCategory !== undefined &&
		(typeof r.clickedCategory !== "string" || !SLUG.test(r.clickedCategory))
	)
		throw bad("clickedCategory");
	if (r.clickedRank !== undefined && !isCount(r.clickedRank, 1000))
		throw bad("clickedRank");

	return {
		query: r.query.trim(),
		scope: r.scope,
		resultCount: r.resultCount,
		outcome: r.outcome as PaletteOutcome,
		clickedCategory: (r.clickedCategory as string | undefined) ?? null,
		clickedRank: (r.clickedRank as number | undefined) ?? null,
	};
}

/**
 * Mounts `POST /telemetry/palette`: anonymous, rate-limited, answers 204.
 *
 * The site sends a sampled share of ⌘K sessions (`VITE_PALETTE_QUERY_SAMPLE_RATE`)
 * as `text/plain` JSON so the browser skips the CORS preflight. The query is
 * redacted again here — the client's redaction is a courtesy, this one is the
 * guarantee — and stored as one row. Deliberately no ip, rid or session in the
 * row: the eval set needs what was asked, not who asked it. Admins read it via
 * `/admin/search-logs/*`; see `docs/features/palette-telemetry.md` (site repo).
 * @param app - The BFF app.
 * @param deps.kv - Rate-limit counters.
 * @param deps.store - Where rows go.
 * @param deps.now - Clock for `ts`; injectable for tests.
 */
export function mountPaletteLog(
	app: Hono<AppEnv>,
	deps: { kv: KV; store: PaletteStore; now?: () => Date },
): void {
	const now = deps.now ?? (() => new Date());

	app.post("/telemetry/palette", async (c) => {
		await enforceRateLimit(
			deps.kv,
			`rl:palette:ip:${c.req.header("x-real-ip") ?? "unknown"}`,
			PALETTE_IP_LIMIT,
			RL_WINDOW_SEC,
		);
		const text = await c.req.text();
		if (text.length > MAX_BODY_CHARS) {
			throw new AppError(413, "PAYLOAD_TOO_LARGE", "Palette report too large");
		}
		let raw: unknown;
		try {
			raw = JSON.parse(text);
		} catch {
			throw new AppError(400, "BAD_REQUEST", "Invalid palette report: body");
		}
		const report = parsePaletteReport(raw);
		try {
			deps.store.insert({
				ts: now().toISOString(),
				...report,
				query: redactIdentifiers(report.query),
			});
		} catch (err) {
			// Telemetry must never fail the visitor's search: a full disk or a
			// locked file loses this row, and the log says so.
			console.error("[eps-backend] palette store insert failed", err);
		}
		return c.body(null, 204);
	});
}
