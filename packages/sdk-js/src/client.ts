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
interface Surface {
	environments: { id: string; baseUrl: string }[];
	endpoints: SdkEndpoint[];
}

// The surface is read at runtime from the shipped `data/` asset (not bundled).
// Import attributes (`assert { type: "json" }`) are avoided because they break
// across Node/tsup/vitest versions; a plain fs read works everywhere.
const here = path.dirname(fileURLToPath(import.meta.url));
const SURFACE_PATH = path.resolve(here, "../data/sdk-surface.json");
const SURFACE = JSON.parse(readFileSync(SURFACE_PATH, "utf8")) as Surface;

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
		const timestamp = String(this.now());
		const headers: Record<string, string> = {
			developer_key: this.opts.developerKey,
			"secret-key": signSecretKey(this.opts.accessKey, timestamp),
			"secret-key-timestamp": timestamp,
			"content-type": "application/json",
		};
		// Path params (e.g. {customer_id}) fill the URL; the rest become the
		// query string on GET, or the JSON body on every other method.
		let path = endpoint.path;
		const rest: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(merged)) {
			const token = `{${k}}`;
			if (path.includes(token))
				path = path.replace(token, encodeURIComponent(String(v)));
			else rest[k] = v;
		}
		let url = `${this.baseUrl}${path}`;
		const init: RequestInit = { method: endpoint.method, headers };
		if (endpoint.method === "GET") {
			const query = new URLSearchParams(
				Object.entries(rest).map(([k, v]) => [k, String(v)]),
			).toString();
			if (query) url += (url.includes("?") ? "&" : "?") + query;
		} else {
			init.body = JSON.stringify(rest);
		}
		const res = await this.fetchFn(url, init);
		return (await res.json()) as T;
	}
}
