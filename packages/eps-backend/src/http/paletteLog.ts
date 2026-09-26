import type { Hono } from "hono";
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
	outcome: "click" | "ask_ai" | "abandon";
	clickedCategory: string | null;
	clickedRank: number | null;
}

/**
 * One sampled ⌘K query. Emitted as a single JSON line to stdout and filtered
 * downstream on the `type: "palette_query"` marker. Deliberately no ip, rid or
 * session: the eval set needs what was asked, not who asked it.
 */
export interface PaletteRecord extends PaletteReport {
	type: "palette_query";
	ts: string;
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
		outcome: r.outcome as PaletteReport["outcome"],
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
 * guarantee — and written as one `palette_query` log line. Retention is the
 * container log rotation (10 MB × 5), so export lines regularly; see
 * `docs/features/palette-telemetry.md`.
 * @param app - The BFF app.
 * @param deps.kv - Rate-limit counters.
 * @param deps.sink - Line destination; defaults to `console.log`.
 * @param deps.now - Clock for `ts`; injectable for tests.
 */
export function mountPaletteLog(
	app: Hono<AppEnv>,
	deps: { kv: KV; sink?: (line: string) => void; now?: () => Date },
): void {
	const sink = deps.sink ?? ((line: string) => console.log(line));
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
		const record: PaletteRecord = {
			type: "palette_query",
			ts: now().toISOString(),
			...report,
			query: redactIdentifiers(report.query),
		};
		try {
			sink(JSON.stringify(record));
		} catch {
			// best-effort: a logging failure must never fail the request
		}
		return c.body(null, 204);
	});
}
