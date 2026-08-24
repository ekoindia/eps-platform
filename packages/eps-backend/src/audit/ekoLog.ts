import { clamp, currentRid, recordUpstream } from "../http/trace";

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
	/**
	 * The request fields sent upstream. `string` for the form-encoded Eko
	 * transport; connect-api posts JSON, so values may be numbers or nested
	 * objects — redaction recurses, so a credential nested under `data` is
	 * caught wherever it sits.
	 */
	fields: Record<string, unknown>;
	/**
	 * Where the call went: an endpoint path for transports with no
	 * `interaction_type_id` to identify the call by (connect-api), or the full
	 * target URL where one interaction can be routed to its own upstream (the
	 * direct Eko transport, whose interaction 154 has its own host and version).
	 */
	path?: string;
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
		// Why a failure happened, not just that it did: `message` is frequently
		// a template ("Please provide the value of the field") whose subject
		// lives only in `invalid_params`. These name FIELDS and carry framework
		// message templates, not user values, so they stay safe at `basic` —
		// unlike `data`, which holds the profile and stays behind `full`.
		"invalid_params",
		"dependent_params",
		"list_items",
	]) {
		if (k in r) out[k] = r[k];
	}
	// An unparseable body has none of those keys, so `basic` would otherwise log a
	// bare `{}` for the one class of failure that carries no status id at all. The
	// body itself stays behind `full`: it is an error page of unknown provenance
	// and may echo request values, which `basic` promises never to emit. Its size
	// is enough to tell an empty reply from a gateway page without quoting either.
	if (typeof r.nonJson === "string") out.nonJsonBytes = r.nonJson.length;
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
const REDACTED_REQUEST_FIELDS = new Set([
	"first_okekey",
	"second_okekey",
	// connect-api credentials. `id_token` is the OTP on /authentication/login;
	// `refresh_token` is long-lived and posted to /token and /revoke — strictly
	// worse to leak than the OTP that `full` already documents as dev-only.
	"id_token",
	"refresh_token",
	"access_token",
]);
const REDACTED_RESPONSE_FIELDS = new Set([
	"pintwin_key",
	// Every token on ConnectLoginEnvelope. Without these a `full`-level login
	// writes a live session's tokens straight to the container log.
	"access_token",
	"access_token_lite",
	"refresh_token",
]);

const REDACTION_PLACEHOLDER = "[REDACTED]";

/**
 * Deep-copies `value`, replacing any property whose name is in `secretKeys`.
 * Recurses because secrets nest: upstream puts `pintwin_key` under `data`, and
 * connect-api posts JSON request bodies whose credentials need not sit at the
 * top level. Never mutates the input.
 */
function redact(value: unknown, secretKeys: Set<string>): unknown {
	if (Array.isArray(value)) return value.map((v) => redact(v, secretKeys));
	if (!value || typeof value !== "object") return value;
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
		out[k] = secretKeys.has(k) ? REDACTION_PLACEHOLDER : redact(v, secretKeys);
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
 * @param opts.type  the record's `type` tag; defaults to `"eko_upstream"`. The
 *                   connect-api client passes `"connect_upstream"` so the two
 *                   transports stay separately greppable in one log stream.
 */
export function createEkoLogger(opts: {
	level: EkoLogLevel;
	sink?: (line: string) => void;
	now?: () => Date;
	type?: string;
}): EkoLogger {
	const { level } = opts;
	const sink = opts.sink ?? ((line: string) => console.log(line));
	const now = opts.now ?? (() => new Date());
	const type = opts.type ?? "eko_upstream";

	return {
		log(entry) {
			// Tracing runs before the level check and in its own try: the browser
			// diagnostic must not depend on how the operator set EKO_LOG_LEVEL, and
			// a trace failure must not cost us the log line (or vice versa).
			try {
				const [response, truncated] = clamp(
					entry.response == null
						? null
						: redact(entry.response, REDACTED_RESPONSE_FIELDS),
				);
				const ref = entry.fields.client_ref_id;
				recordUpstream({
					path: entry.path ?? null,
					clientRefId: ref == null ? null : String(ref),
					status: entry.status ?? null,
					durMs: entry.durMs,
					error: entry.error ?? null,
					response,
					...(truncated ? { truncated: true } : {}),
				});
			} catch {
				// best-effort: tracing must never break an upstream call
			}
			if (level === "off") return;
			try {
				const f = entry.fields;
				const base = {
					type,
					ts: now().toISOString(),
					// Joins this line to the access-log line for the same request.
					// Without it the two logs can only be correlated by timestamp.
					rid: currentRid(),
					interaction_type_id: f.interaction_type_id,
					path: entry.path ?? null,
					http_status: entry.status ?? null,
					durMs: entry.durMs,
					error: entry.error ?? null,
				};
				const record =
					level === "full"
						? {
								...base,
								request: redact(f, REDACTED_REQUEST_FIELDS),
								response:
									entry.response == null
										? null
										: redact(entry.response, REDACTED_RESPONSE_FIELDS),
							}
						: {
								...base,
								mobile: maskMobile(
									f.mobile == null ? undefined : String(f.mobile),
								),
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
