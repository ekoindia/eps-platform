import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface SdkParam {
	name: string;
	type: string;
	required: boolean;
	/** Key into the surface's `formats`; the wire string must match. */
	format?: string;
	/** Allowed values, compared as wire strings. */
	enum?: (string | number)[];
	/** Inclusive numeric bounds. */
	min?: number;
	max?: number;
	/** Max length of the wire string in UTF-8 bytes. */
	maxLength?: number;
}
export interface SdkEndpoint {
	slug: string;
	method: string;
	path: string;
	params: SdkParam[];
	requiredParams: string[];
	/** Money-moving endpoint: an indeterminate failure is followed by a status
	 * check on the `client_ref_id` before the error is surfaced. */
	financial?: boolean;
}

/** Cross-realm-safe Blob check (covers File, which extends Blob). */
const isBlob = (value: unknown): value is Blob =>
	typeof Blob !== "undefined" && value instanceof Blob;

/**
 * Lenient, coercion-aware type check against a spec type. Only present values
 * are checked (presence is enforced separately). Unknown types pass. The wire
 * sends everything as strings, so numeric/boolean strings are accepted.
 */
const matchesType = (type: string, value: unknown): boolean => {
	switch (type) {
		case "string":
			// Strings and numbers (which coerce cleanly); not booleans/objects.
			return typeof value === "string" || typeof value === "number";
		case "file":
			// A local file path (read by the SDK) or a Blob/File.
			return typeof value === "string" || isBlob(value);
		case "number":
			return (
				(typeof value === "number" && Number.isFinite(value)) ||
				(typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value))
			);
		case "integer":
			return (
				(typeof value === "number" && Number.isInteger(value)) ||
				(typeof value === "string" && /^-?\d+$/.test(value))
			);
		case "boolean":
			return (
				typeof value === "boolean" || value === "true" || value === "false"
			);
		default:
			return true; // unknown/unsupported spec type → not enforced
	}
};

/** Spec types whose values are scalars the value checks can stringify. */
const SCALAR_TYPES = new Set(["string", "number", "integer", "boolean"]);

/**
 * Value check after the type check: enum → format → min/max → maxLength, on the
 * wire string (`String(value)`) so `5` and `"5"` behave alike. Returns the first
 * problem as the reason text, or null. Formats are syntactic regexes from the
 * surface, matched whole-string. `maxLength` counts UTF-8 bytes — the one
 * length every language agrees on without an ICU dependency.
 */
export const valueProblem = (
	p: SdkParam,
	value: unknown,
	formats: Map<string, RegExp>,
): string | null => {
	if (!SCALAR_TYPES.has(p.type)) return null;
	const wire = String(value);
	if (p.enum && !p.enum.some((allowed) => String(allowed) === wire))
		return `not one of: ${p.enum.join(", ")}`;
	if (p.format) {
		const re = formats.get(p.format);
		if (re && !re.test(wire)) return `expected format ${p.format}`;
	}
	if (p.min !== undefined || p.max !== undefined) {
		const n = Number(wire);
		if (p.min !== undefined && n < p.min) return `below min ${p.min}`;
		if (p.max !== undefined && n > p.max) return `above max ${p.max}`;
	}
	if (p.maxLength !== undefined && Buffer.byteLength(wire) > p.maxLength)
		return `longer than ${p.maxLength} bytes`;
	return null;
};

/**
 * client_ref_id for a non-GET call that did not supply one: base36 millisecond
 * stamp (sortable, greppable against a log line) plus 7 random base36 chars,
 * exactly 15 of `[0-9a-z]`. Under EPS's 20-char limit with ~7.8e10 distinct
 * tails per millisecond, so concurrent processes cannot collide in practice.
 * Same shape in every SDK — see docs/sdk-golden-vector.md.
 */
export const generateClientRefId = (nowMs: number): string => {
	const tail = crypto
		.randomInt(0, 36 ** 7)
		.toString(36)
		.padStart(7, "0");
	return (nowMs.toString(36) + tail).slice(-15);
};

/**
 * Name of the single form field carrying every non-file value as one JSON
 * object. Eko's upload APIs do not take a form field per parameter. Mirrors
 * `MULTIPART_JSON_FIELD` in the website's `src/lib/data/api-specs-common.ts`.
 */
export const MULTIPART_JSON_FIELD = "form-data";

/**
 * Multipart body for a file-upload endpoint: one `form-data` part holding every
 * non-file value as JSON, plus a part per upload. File params accept a local
 * file path (read here, filename = basename) or a Blob/File (a File keeps its
 * own name). null / undefined values are dropped before serialization — a form
 * field has no null encoding — while nulls nested inside an object value are
 * preserved by JSON.
 */
const buildFormData = (
	values: Record<string, unknown>,
	fileParams: Set<string>,
): FormData => {
	const form = new FormData();
	const payload: Record<string, unknown> = {};
	const uploads: Array<[string, Blob, string]> = [];
	for (const [name, value] of Object.entries(values)) {
		if (value == null) continue;
		if (fileParams.has(name)) {
			const blob = isBlob(value)
				? value
				: new Blob([readFileSync(String(value))]);
			const filename = isBlob(value)
				? ((value as File).name ?? name)
				: path.basename(String(value));
			uploads.push([name, blob, filename]);
		} else {
			payload[name] = value;
		}
	}
	// Envelope first, then the uploads — the order the API documents.
	form.append(MULTIPART_JSON_FIELD, JSON.stringify(payload));
	for (const [name, blob, filename] of uploads)
		form.append(name, blob, filename);
	return form;
};

/**
 * Client-side failure: a bad option, an unknown slug, a missing required param,
 * a wrong param type, or a response that could not be read.
 */
export class EpsError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = "EpsError";
	}
}

/**
 * Non-2xx response from EPS. The decoded envelope is kept on `body` so callers
 * can inspect it, but this is THROWN rather than returned: an auth or
 * infrastructure failure must never be mistaken for a successful call.
 */
export class EpsHttpError extends EpsError {
	constructor(
		readonly status: number,
		readonly url: string,
		readonly body: unknown,
		readonly raw: string,
	) {
		super(`EPS request to ${url} failed with HTTP ${status}.`);
		this.name = "EpsHttpError";
	}
}

/**
 * A non-GET call on a money-moving endpoint ended without a confirmed outcome
 * (timeout, transport failure, HTTP 429 or 5xx). The SDK never re-sends such a
 * request — that is how a customer gets debited twice — so it inquired by the
 * call's `client_ref_id` instead and reports what it found. `statusCheck` is the
 * Transaction Inquiry envelope (`data.tx_status`: 0 success, 1 fail, 2 awaited,
 * …) or null when the inquiry itself failed, in which case `statusCheckError`
 * says why. The original failure is the `cause`. Reconcile with the ref before
 * retrying; never assume a timeout meant failure.
 */
export class EpsIndeterminateError extends EpsError {
	/** HTTP status of the original attempt, or null for a transport failure. */
	readonly status: number | null;
	constructor(
		readonly slug: string,
		readonly clientRefId: string,
		cause: unknown,
		readonly statusCheck: unknown,
		readonly statusCheckError: unknown,
	) {
		super(
			`EPS request for "${slug}" with client_ref_id "${clientRefId}" has no confirmed outcome.`,
			{ cause },
		);
		this.name = "EpsIndeterminateError";
		this.status = cause instanceof EpsHttpError ? cause.status : null;
	}
}

/** True when the outcome is unknown: no response, or a 429/5xx that says
 * nothing about whether the request was processed. A 4xx is a decisive no. */
const isIndeterminate = (err: unknown): boolean =>
	err instanceof EpsHttpError
		? err.status === 429 || err.status >= 500
		: !(err instanceof EpsError);

/** Decode a response body, or null when it is not JSON — the non-2xx path still
 * wants whatever envelope the server sent. Mirrors `_decode_json_or_none` in
 * the Python SDK.
 * ponytail: a literal `null` body is indistinguishable from "not JSON" here.
 * Java behaves the same and EPS never returns a bare `null` envelope. */
const decodeJsonOrNull = (raw: string): unknown => {
	try {
		return JSON.parse(raw) as unknown;
	} catch {
		return null;
	}
};

/** Per-attempt budget, matching the 30s every other EPS SDK defaults to. */
const DEFAULT_TIMEOUT_MS = 30_000;
/** Extra attempts for a GET that ended indeterminate. */
const DEFAULT_RETRIES = 2;
/** Backoff base: attempt n waits a random slice of min(base × 2^(n-1), 2s). */
const DEFAULT_RETRY_BASE_DELAY_MS = 200;
const MAX_RETRY_DELAY_MS = 2_000;
/** Generic status-check endpoint, keyed by TID or `client_ref_id:<ref>`. */
const INQUIRY_SLUG = "transaction-inquiry";

interface Surface {
	environments: { id: string; baseUrl: string }[];
	endpoints: SdkEndpoint[];
	formats?: Record<string, string>;
}

// The surface is read at runtime from the shipped `data/` asset (not bundled).
// Import attributes (`assert { type: "json" }`) are avoided because they break
// across Node/tsup/vitest versions; a plain fs read works everywhere.
const here = path.dirname(fileURLToPath(import.meta.url));
const SURFACE_PATH = path.resolve(here, "../data/sdk-surface.json");

/**
 * Load the baked surface asset, failing with a clear message if it is missing
 * or malformed (a build/packaging error) rather than a downstream undefined.
 */
const loadSurface = (): Surface => {
	let raw: string;
	try {
		raw = readFileSync(SURFACE_PATH, "utf8");
	} catch {
		throw new EpsError(
			`EPS SDK surface not found at ${SURFACE_PATH}. The package is built incorrectly (run \`npm run build\` to bake it).`,
		);
	}
	const parsed = JSON.parse(raw) as Surface;
	if (!parsed?.environments || !parsed?.endpoints) {
		throw new EpsError(
			`EPS SDK surface at ${SURFACE_PATH} is invalid or corrupt.`,
		);
	}
	return parsed;
};
const SURFACE = loadSurface();

/** Compiled once. A pattern that does not compile is corrupt package data —
 * fail here, loudly, rather than silently skipping a validation. No `m` flag,
 * so `$` is the end of the string and a trailing newline cannot slip past. */
const FORMATS = new Map(
	Object.entries(SURFACE.formats ?? {}).map(([name, pattern]) => {
		try {
			return [name, new RegExp(pattern)] as const;
		} catch {
			throw new EpsError(
				`EPS SDK surface at ${SURFACE_PATH} is invalid or corrupt: format "${name}" does not compile.`,
			);
		}
	}),
);

export interface EpsClientOptions {
	developerKey: string;
	accessKey: string;
	environment: "sandbox" | "production";
	/** Default `initiator_id` (registered mobile of the API user) injected into
	 * every call. Near-constant per developer; override per call by passing
	 * `initiator_id` in `params`. */
	initiatorId?: string;
	/** Default `user_code` (retailer/agent code) injected into every call.
	 * Override per call by passing `user_code` in `params`. */
	userCode?: string;
	fetch?: typeof fetch;
	/** Abort a request that takes longer than this, in milliseconds. Default
	 * 30_000 — the 30s every other EPS SDK defaults to. Named `timeoutMs` (not
	 * `timeout`) because Python's `timeout` is in seconds; the unit is in the
	 * name so the two can never be confused. Applies per attempt. Per-call
	 * cancellation signals are not supported yet. */
	timeoutMs?: number;
	/** Extra attempts for a GET whose outcome was indeterminate (timeout,
	 * transport failure, HTTP 429/5xx). Default 2 — three tries in all. Non-GET
	 * calls are never retried. Set 0 to disable. */
	retries?: number;
	/** Backoff base in milliseconds: attempt n waits a random slice of
	 * min(base × 2^(n-1), 2000). Default 200; 0 retries immediately (tests). */
	retryBaseDelayMs?: number;
	/** After an indeterminate failure on a money-moving (`financial`) endpoint,
	 * look the transaction up by its `client_ref_id` and surface the result on
	 * `EpsIndeterminateError.statusCheck`. Default true. */
	autoStatusCheck?: boolean;
	now?: () => number;
}

/** secret-key = base64(HMAC-SHA256(timestamp, base64(access_key))). */
export const signSecretKey = (accessKey: string, timestamp: string): string => {
	const encodedKey = Buffer.from(accessKey).toString("base64");
	return crypto
		.createHmac("sha256", encodedKey)
		.update(timestamp)
		.digest("base64");
};

export class EpsClient {
	private readonly baseUrl: string;
	private readonly fetchFn: typeof fetch;
	private readonly timeoutMs: number;
	private readonly retries: number;
	private readonly retryBaseDelayMs: number;
	private readonly autoStatusCheck: boolean;
	private readonly now: () => number;

	constructor(private readonly opts: EpsClientOptions) {
		// Backend-only guard: access_key must never run in a browser.
		if (typeof (globalThis as { window?: unknown }).window !== "undefined") {
			throw new EpsError(
				"EpsClient is backend-only: never instantiate it in a browser (access_key would leak).",
			);
		}
		const env = SURFACE.environments.find((e) => e.id === opts.environment);
		if (!env) throw new EpsError(`Unknown environment "${opts.environment}".`);
		this.baseUrl = env.baseUrl;
		this.fetchFn = opts.fetch ?? fetch;
		const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
		if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
			throw new EpsError(
				`Invalid timeoutMs: ${String(opts.timeoutMs)}. Expected a positive number of milliseconds.`,
			);
		this.timeoutMs = timeoutMs;
		const retries = opts.retries ?? DEFAULT_RETRIES;
		if (!Number.isInteger(retries) || retries < 0)
			throw new EpsError(
				`Invalid retries: ${String(opts.retries)}. Expected a non-negative integer.`,
			);
		this.retries = retries;
		const baseDelay = opts.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
		if (!Number.isFinite(baseDelay) || baseDelay < 0)
			throw new EpsError(
				`Invalid retryBaseDelayMs: ${String(opts.retryBaseDelayMs)}. Expected a non-negative number of milliseconds.`,
			);
		this.retryBaseDelayMs = baseDelay;
		this.autoStatusCheck = opts.autoStatusCheck ?? true;
		this.now = opts.now ?? Date.now;
	}

	private endpoint(slug: string): SdkEndpoint {
		const e = SURFACE.endpoints.find((x) => x.slug === slug);
		if (!e) throw new EpsError(`Unknown endpoint slug "${slug}".`);
		return e;
	}

	/**
	 * Sign and send one endpoint call, returning the decoded response envelope.
	 *
	 * Validates first (throws `EpsError`, nothing sent), then sends. A GET whose
	 * outcome is indeterminate is retried; a non-GET never is — on a `financial`
	 * endpoint it is followed by a Transaction Inquiry on its `client_ref_id`
	 * and thrown as `EpsIndeterminateError`. See docs/sdk-golden-vector.md.
	 */
	async call<T = unknown>(
		slug: string,
		params: Record<string, unknown> = {},
	): Promise<T> {
		const { endpoint, merged, clientRefId, ...target } = this.resolve(
			slug,
			params,
		);
		const attempts = endpoint.method === "GET" ? this.retries + 1 : 1;
		for (let attempt = 1; ; attempt++) {
			try {
				return (await this.send(endpoint, target)) as T;
			} catch (err) {
				if (!isIndeterminate(err)) throw err;
				if (attempt < attempts) {
					await this.backoff(attempt);
					continue;
				}
				// Never re-send a non-GET: that is how a customer is debited twice.
				// Ask EPS what happened to the ref instead, if there is one to ask by.
				if (
					this.autoStatusCheck &&
					endpoint.financial &&
					clientRefId !== undefined
				)
					throw await this.indeterminate(
						slug,
						clientRefId,
						merged["initiator_id"],
						err,
					);
				throw err;
			}
		}
	}

	/** Attempt n sleeps a random slice of min(base × 2^(n-1), 2s) — full jitter. */
	private async backoff(attempt: number): Promise<void> {
		const cap = Math.min(
			this.retryBaseDelayMs * 2 ** (attempt - 1),
			MAX_RETRY_DELAY_MS,
		);
		const delay = Math.floor(Math.random() * (cap + 1));
		if (delay > 0) await new Promise((r) => setTimeout(r, delay));
	}

	/** One inquiry by `client_ref_id:<ref>`; its own failure is reported, never
	 * allowed to mask the original one. */
	private async indeterminate(
		slug: string,
		clientRefId: string,
		initiatorId: unknown,
		cause: unknown,
	): Promise<EpsIndeterminateError> {
		let statusCheck: unknown = null;
		let statusCheckError: unknown = null;
		try {
			statusCheck = await this.call(INQUIRY_SLUG, {
				"transaction-reference": `client_ref_id:${clientRefId}`,
				...(initiatorId !== undefined && { initiator_id: initiatorId }),
			});
		} catch (err) {
			statusCheckError = err;
		}
		return new EpsIndeterminateError(
			slug,
			clientRefId,
			cause,
			statusCheck,
			statusCheckError,
		);
	}

	/**
	 * Validate and build everything but the signature: the URL, the body and
	 * the merged params. Signing happens per attempt in `send`, so a retry
	 * never reuses a stale `secret-key-timestamp`.
	 */
	private resolve(slug: string, params: Record<string, unknown>) {
		const endpoint = this.endpoint(slug);
		// Client-level defaults (initiator_id, user_code) are injected first; an
		// explicit per-call value — including an explicit null to clear one —
		// overrides because `...params` comes last.
		const merged: Record<string, unknown> = {
			...(this.opts.initiatorId !== undefined && {
				initiator_id: this.opts.initiatorId,
			}),
			...(this.opts.userCode !== undefined && {
				user_code: this.opts.userCode,
			}),
			...params,
		};
		// Every non-GET call carries a client_ref_id — the key a partner reconciles
		// a lost response by. Generated only when the endpoint declares the param
		// and the caller sent none (absent or null); a supplied value, even "",
		// is theirs to own. Done before the required-param guard so a generated
		// ref satisfies endpoints that require one.
		const declaresRef =
			endpoint.method !== "GET" &&
			endpoint.params.some((p) => p.name === "client_ref_id");
		if (declaresRef && merged["client_ref_id"] == null)
			merged["client_ref_id"] = generateClientRefId(this.now());
		const clientRefId = declaresRef
			? String(merged["client_ref_id"])
			: undefined;
		// Spec-driven guard: every requiredParam (from the API spec, baked into the
		// surface) must be present and non-null before we sign and send.
		const missing = endpoint.requiredParams.filter(
			(p) => merged[p] === undefined || merged[p] === null,
		);
		if (missing.length)
			throw new EpsError(
				`Missing required params for "${slug}": ${missing.join(", ")}.`,
			);
		// Type guard: every provided param known to the spec must match its type.
		// Unknown params (not in the surface) pass through untouched.
		const badTypes = endpoint.params
			.filter(
				(p) =>
					merged[p.name] !== undefined &&
					merged[p.name] !== null &&
					!matchesType(p.type, merged[p.name]),
			)
			.map((p) => `${p.name} (expected ${p.type})`);
		if (badTypes.length)
			throw new EpsError(
				`Invalid param types for "${slug}": ${badTypes.join(", ")}.`,
			);
		// Value guard: enum / format / min / max / maxLength from the spec, on the
		// same provided params. Syntactic only — the server still owns semantics.
		const badValues = endpoint.params.flatMap((p) => {
			const value = merged[p.name];
			if (value === undefined || value === null) return [];
			const reason = valueProblem(p, value, FORMATS);
			return reason ? [`${p.name} (${reason})`] : [];
		});
		if (badValues.length)
			throw new EpsError(
				`Invalid param values for "${slug}": ${badValues.join(", ")}.`,
			);
		// A `type:"file"` param flips the whole request to multipart/form-data.
		const fileParams = new Set(
			endpoint.params.filter((p) => p.type === "file").map((p) => p.name),
		);
		const multipart = fileParams.size > 0;
		// Path params (e.g. {customer_id}) fill the URL; the rest become the
		// query string on GET, a FormData body when the endpoint has file
		// uploads, or the JSON body on every other method.
		let path = endpoint.path;
		const rest: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(merged)) {
			const token = `{${k}}`;
			if (path.includes(token))
				path = path.replace(token, encodeURIComponent(String(v)));
			else rest[k] = v;
		}
		let url = `${this.baseUrl}${path}`;
		let body: RequestInit["body"];
		if (endpoint.method === "GET") {
			const query = new URLSearchParams(
				Object.entries(rest).map(([k, v]) => [k, String(v)]),
			).toString();
			if (query) url += (url.includes("?") ? "&" : "?") + query;
		} else if (multipart) {
			body = buildFormData(rest, fileParams);
		} else {
			body = JSON.stringify(rest);
		}
		return { endpoint, merged, clientRefId, url, body, multipart };
	}

	/** Sign (fresh timestamp) and send one attempt; decode per the contract. */
	private async send(
		endpoint: SdkEndpoint,
		target: { url: string; body: RequestInit["body"]; multipart: boolean },
	): Promise<unknown> {
		const { url, body, multipart } = target;
		const timestamp = String(this.now());
		const headers: Record<string, string> = {
			developer_key: this.opts.developerKey,
			"secret-key": signSecretKey(this.opts.accessKey, timestamp),
			"secret-key-timestamp": timestamp,
			// Multipart: no explicit content-type — fetch derives it (with the
			// generated boundary) from the FormData body.
			...(multipart ? {} : { "content-type": "application/json" }),
		};
		const init: RequestInit = {
			method: endpoint.method,
			headers,
			signal: AbortSignal.timeout(this.timeoutMs),
		};
		if (body !== undefined) init.body = body;
		const res = await this.fetchFn(url, init);
		const raw = await res.text();
		const envelope = decodeJsonOrNull(raw);
		// A non-2xx envelope is an error, not a result — see docs/sdk-golden-vector.md.
		if (!res.ok) throw new EpsHttpError(res.status, url, envelope, raw);
		if (envelope === null)
			throw new EpsError(`EPS response from ${url} was not valid JSON.`);
		return envelope;
	}
}
