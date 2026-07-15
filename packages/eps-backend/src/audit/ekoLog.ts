/**
 * Verbosity for the Eko/SimpliBank upstream request/response log.
 *
 * - `off`   — emit nothing.
 * - `basic` — metadata only: interaction id, masked mobile, org, duration, and a
 *             small response summary (status ids + message). No OTP, no merchant
 *             credentials, no full bodies. Safe for production.
 * - `full`  — the complete request form-fields (incl. OTP) and the full response
 *             body. For development/debugging only. (The `developer_key` /
 *             `secret-key` headers are never in the form-fields, so they never log.)
 */
export type EkoLogLevel = "off" | "basic" | "full";

/** Set on the `EKO_LOG_LEVEL` env var; unknown values fall back to `basic`. */
export function parseEkoLogLevel(raw: string | undefined): EkoLogLevel {
	const v = (raw ?? "basic").toLowerCase();
	return v === "off" || v === "full" ? v : "basic";
}

/** One upstream call to log: the request form-fields plus the outcome. */
export interface EkoLogEntry {
	/** The form-encoded request fields sent to the upstream. */
	fields: Record<string, string>;
	/** HTTP status of the upstream response; undefined on a transport failure. */
	status?: number;
	/** Parsed response body (or `{ nonJson }` when unparseable). */
	response?: unknown;
	/** Transport/parse error message, when the call did not yield a JSON body. */
	error?: string;
	/** Round-trip duration in milliseconds. */
	durMs: number;
}

/** Logs one line per upstream call. Best-effort and never throws. */
export interface EkoLogger {
	log(entry: EkoLogEntry): void;
}

/** Masks all but the last 4 digits of a mobile number. */
function maskMobile(m: string | undefined): string | undefined {
	if (!m) return m;
	return "•".repeat(Math.max(0, m.length - 4)) + m.slice(-4);
}

/**
 * Picks only the known status/outcome fields from an upstream response, so the
 * `basic` level can report success/failure without dumping the full (possibly
 * PII-bearing) body.
 */
function responseSummary(response: unknown): Record<string, unknown> {
	if (!response || typeof response !== "object") return { body: response };
	const r = response as Record<string, unknown>;
	const out: Record<string, unknown> = {};
	for (const k of [
		"response_status_id",
		"response_type_id",
		"response_code",
		"status",
		"message",
	]) {
		if (k in r) out[k] = r[k];
	}
	return out;
}

/**
 * Fields that must never be logged, at any level.
 *
 * The secret PIN is never sent upstream raw — the BFF encodes it — but the
 * pintwin encoding is a plain digit substitution, so an `okekey` logged
 * alongside the `pintwin_key` that produced it recovers the PIN exactly.
 * Redacting either one breaks that; we redact both.
 */
const REDACTED_REQUEST_FIELDS = new Set(["first_okekey", "second_okekey"]);
const REDACTED_RESPONSE_FIELDS = new Set(["pintwin_key"]);

const REDACTION_PLACEHOLDER = "[REDACTED]";

/** Returns a copy of `fields` with sensitive entries replaced. Never mutates the input. */
function redactFields(fields: Record<string, string>): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [k, v] of Object.entries(fields)) {
		out[k] = REDACTED_REQUEST_FIELDS.has(k) ? REDACTION_PLACEHOLDER : v;
	}
	return out;
}

/**
 * Deep-copies `value`, replacing any property named in REDACTED_RESPONSE_FIELDS.
 * Upstream nests the pintwin key under `data`, so this must recurse. Never
 * mutates the input.
 */
function redactResponse(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(redactResponse);
	if (!value || typeof value !== "object") return value;
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
		out[k] = REDACTED_RESPONSE_FIELDS.has(k)
			? REDACTION_PLACEHOLDER
			: redactResponse(v);
	}
	return out;
}

/**
 * Creates the upstream logger. Serializes each record to one JSON line
 * (`type: "eko_upstream"`) and passes it to `sink` (default `console.log`).
 * Serialization and sink failures are swallowed — logging must never break or
 * alter an upstream call.
 *
 * @param opts.level verbosity; `off` makes `log()` a no-op
 * @param opts.sink  destination for each JSON line; defaults to `console.log`
 * @param opts.now   clock for the `ts` field; defaults to `() => new Date()`
 */
export function createEkoLogger(opts: {
	level: EkoLogLevel;
	sink?: (line: string) => void;
	now?: () => Date;
}): EkoLogger {
	const { level } = opts;
	const sink = opts.sink ?? ((line: string) => console.log(line));
	const now = opts.now ?? (() => new Date());

	return {
		log(entry) {
			if (level === "off") return;
			try {
				const f = entry.fields;
				const base = {
					type: "eko_upstream",
					ts: now().toISOString(),
					interaction_type_id: f.interaction_type_id,
					http_status: entry.status ?? null,
					durMs: entry.durMs,
					error: entry.error ?? null,
				};
				const record =
					level === "full"
						? {
								...base,
								request: redactFields(f),
								response:
									entry.response == null ? null : redactResponse(entry.response),
							}
						: {
								...base,
								mobile: maskMobile(f.mobile),
								org_id: f.org_id,
								response: responseSummary(entry.response),
							};
				void Promise.resolve(sink(JSON.stringify(record))).catch(() => {});
			} catch {
				// best-effort: a logging failure must never propagate
			}
		},
	};
}

/** A logger that does nothing — the default when none is injected. */
export const noopEkoLogger: EkoLogger = {
	log() {},
};
