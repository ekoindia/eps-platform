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
 * Multipart body for a file-upload endpoint. File params accept a local file
 * path (read here, filename = basename) or a Blob/File (a File keeps its own
 * name). Other values become text parts — objects as JSON strings. null /
 * undefined values are omitted: a form field has no null encoding.
 */
const buildFormData = (
	values: Record<string, unknown>,
	fileParams: Set<string>,
): FormData => {
	const form = new FormData();
	for (const [name, value] of Object.entries(values)) {
		if (value == null) continue;
		if (fileParams.has(name)) {
			const blob = isBlob(value)
				? value
				: new Blob([readFileSync(String(value))]);
			const filename = isBlob(value)
				? ((value as File).name ?? name)
				: path.basename(String(value));
			form.append(name, blob, filename);
		} else {
			form.append(
				name,
				typeof value === "object" ? JSON.stringify(value) : String(value),
			);
		}
	}
	return form;
};

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
		throw new Error(
			`EPS SDK surface not found at ${SURFACE_PATH}. The package is built incorrectly (run \`npm run build\` to bake it).`,
		);
	}
	const parsed = JSON.parse(raw) as Surface;
	if (!parsed?.environments || !parsed?.endpoints) {
		throw new Error(
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

/**
 * Generate a unique client_ref_id using Node's crypto module.
 * Uses crypto.randomUUID() when available (Node >= 14.17 / Node >= 19 stable),
 * falling back to crypto.randomBytes(16).toString('hex').
 */
const generateClientRefId = (): string => {
	if (typeof crypto.randomUUID === "function") {
		return crypto.randomUUID();
	}
	return crypto.randomBytes(16).toString("hex");
};

export class EpsClient {
	private readonly baseUrl: string;
	private readonly fetchFn: typeof fetch;
	private readonly now: () => number;

	constructor(private readonly opts: EpsClientOptions) {
		// Backend-only guard: access_key must never run in a browser.
		if (typeof (globalThis as { window?: unknown }).window !== "undefined") {
			throw new Error(
				"EpsClient is backend-only: never instantiate it in a browser (access_key would leak).",
			);
		}
		const env = SURFACE.environments.find((e) => e.id === opts.environment);
		if (!env) throw new Error(`Unknown environment "${opts.environment}".`);
		this.baseUrl = env.baseUrl;
		this.fetchFn = opts.fetch ?? fetch;
		this.now = opts.now ?? Date.now;
	}

	private endpoint(slug: string): SdkEndpoint {
		const e = SURFACE.endpoints.find((x) => x.slug === slug);
		if (!e) throw new Error(`Unknown endpoint slug "${slug}".`);
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
		// Auto-inject client_ref_id for non-GET requests when the caller has not
		// supplied one. Done BEFORE required-param validation so a generated id
		// satisfies endpoints that require client_ref_id, and every mutating request
		// gets a unique idempotency key without the caller thinking about it.
		if (endpoint.method !== "GET" && merged["client_ref_id"] == null) {
			merged["client_ref_id"] = generateClientRefId();
		}
		// Spec-driven guard: every requiredParam (from the API spec, baked into the
		// surface) must be present and non-null before we sign and send.
		const missing = endpoint.requiredParams.filter(
			(p) => merged[p] === undefined || merged[p] === null,
		);
		if (missing.length)
			throw new Error(
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
			throw new Error(
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
		let urlPath = endpoint.path;
		const rest: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(merged)) {
			const token = `{${k}}`;
			if (urlPath.includes(token))
				urlPath = urlPath.replace(token, encodeURIComponent(String(v)));
			else rest[k] = v;
		}
		let url = `${this.baseUrl}${urlPath}`;
		const init: RequestInit = { method: endpoint.method, headers };
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
		return (await res.json()) as T;
	}
}
