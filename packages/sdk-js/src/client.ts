import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface SdkParam {
	name: string;
	type: string;
	required: boolean;
}
export interface SdkEndpoint {
	slug: string;
	method: string;
	path: string;
	params: SdkParam[];
	requiredParams: string[];
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

/** Whole-request budget, matching the 30s every other EPS SDK defaults to. */
const DEFAULT_TIMEOUT_MS = 30_000;

interface Surface {
	environments: { id: string; baseUrl: string }[];
	endpoints: SdkEndpoint[];
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
	 * name so the two can never be confused. Per-call cancellation signals are
	 * not supported yet. */
	timeoutMs?: number;
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
		this.now = opts.now ?? Date.now;
	}

	private endpoint(slug: string): SdkEndpoint {
		const e = SURFACE.endpoints.find((x) => x.slug === slug);
		if (!e) throw new EpsError(`Unknown endpoint slug "${slug}".`);
		return e;
	}

	async call<T = unknown>(
		slug: string,
		params: Record<string, unknown> = {},
	): Promise<T> {
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
		// A `type:"file"` param flips the whole request to multipart/form-data.
		const fileParams = new Set(
			endpoint.params.filter((p) => p.type === "file").map((p) => p.name),
		);
		const multipart = fileParams.size > 0;
		const timestamp = String(this.now());
		const headers: Record<string, string> = {
			developer_key: this.opts.developerKey,
			"secret-key": signSecretKey(this.opts.accessKey, timestamp),
			"secret-key-timestamp": timestamp,
			// Multipart: no explicit content-type — fetch derives it (with the
			// generated boundary) from the FormData body.
			...(multipart ? {} : { "content-type": "application/json" }),
		};
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
		const init: RequestInit = {
			method: endpoint.method,
			headers,
			signal: AbortSignal.timeout(this.timeoutMs),
		};
		if (endpoint.method === "GET") {
			const query = new URLSearchParams(
				Object.entries(rest).map(([k, v]) => [k, String(v)]),
			).toString();
			if (query) url += (url.includes("?") ? "&" : "?") + query;
		} else if (multipart) {
			init.body = buildFormData(rest, fileParams);
		} else {
			init.body = JSON.stringify(rest);
		}
		const res = await this.fetchFn(url, init);
		const raw = await res.text();
		const envelope = decodeJsonOrNull(raw);
		// A non-2xx envelope is an error, not a result — see docs/sdk-golden-vector.md.
		if (!res.ok) throw new EpsHttpError(res.status, url, envelope, raw);
		if (envelope === null)
			throw new EpsError(`EPS response from ${url} was not valid JSON.`);
		return envelope as T;
	}
}
