import type { Config } from "../config";
import { withTimeout } from "./http";

/** One Zoho CRM Lead record, exactly as the CRM returns it. */
export type ZohoLead = Record<string, unknown>;

/**
 * Lead fields a signed-in partner may write through `PATCH /crm/lead`.
 *
 * An allowlist, not a denylist: Zoho accepts an unknown `api_name` silently, so
 * anything not named here is refused before it reaches the CRM rather than
 * quietly writing nothing. Verified against
 * `GET /crm/v2/settings/fields?module=Leads` — re-check there before adding.
 */
export const WRITABLE_LEAD_FIELDS = [
	"Company",
	"Business_Type",
	"Pro_Required",
	"Website",
	"GST_No",
	"Activation_Fee_Discount",
	"Activation_Fee_Status",
	"Activation_Fee_Paid_INR",
	"UTR_No",
	"Go_Live_Disposition",
	"Date_of_Go_live",
	"Integration_Status",
	"Developer_s_Name",
	"Developer_s_Email",
	"Developer_s_Phone_No",
	"Programming_Language",
	"Profession",
	"Authorized_Signatory_Full_name",
	"Authorized_Signatory_Phone_Number",
] as const;

export type WritableLeadField = (typeof WRITABLE_LEAD_FIELDS)[number];

const WRITABLE = new Set<string>(WRITABLE_LEAD_FIELDS);

/** True when `name` is a Lead field this service is willing to write. */
export function isWritableLeadField(name: string): name is WritableLeadField {
	return WRITABLE.has(name);
}

/**
 * A Zoho call that failed. Carries the upstream detail for the server log; the
 * routes deliberately do NOT forward `message` to the browser, since it can
 * name CRM internals.
 */
export class ZohoError extends Error {
	/** HTTP status, when the failure was an HTTP one. */
	status?: number;
	constructor(message: string, status?: number) {
		super(message);
		this.name = "ZohoError";
		this.status = status;
	}
}

export interface ZohoClient {
	/** Whether any Lead carries this mobile. Never throws — see `findLead`. */
	findLead(mobile: string): Promise<boolean>;
	/** One Lead by record id, or null when the CRM has no such record. */
	getLead(id: string): Promise<ZohoLead | null>;
	/** Writes `fields` onto one Lead. Callers must pre-filter against the allowlist. */
	updateLead(id: string, fields: Record<string, unknown>): Promise<void>;
}

/**
 * Checked before interpolation so a junk `crm_lead_id` from upstream cannot
 * reshape the request path. Deliberately wider than "digits only": Zoho ids
 * usually arrive numeric, but upstream is not this service's to guarantee, and
 * refusing a legitimate id is a worse failure than allowing an inert one.
 */
const RECORD_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Refresh this many seconds before Zoho's stated expiry. */
const REFRESH_MARGIN_SEC = 600;
/** Cache lifetime when Zoho sends no usable `expires_in`. */
const FALLBACK_TTL_SEC = 300;

interface TokenCache {
	token: string;
	expiresAt: number;
}

/**
 * Live Zoho CRM Leads client on the OAuth refresh-token grant.
 *
 * The access token is cached in memory and refreshed ahead of expiry; a 401
 * drops the cache and retries once, so a token revoked in the Zoho console
 * recovers on the next request instead of wedging the process until restart.
 *
 * Ported from `eko-business-dashboard/src/lib/crm/client.ts`, trimmed to the
 * single-record operations this service needs. The cache is per instance rather
 * than module-scope (as it is there): this service builds exactly one client, in
 * `buildApp`, so a shared cache would only make config differences invisible and
 * test ordering fragile.
 *
 * @param cfg - The `zoho` config block.
 * @param fetchImpl - Fetch to use; injected by tests.
 * @returns A client whose every method no-ops or throws when Zoho is disabled.
 */
export function createZohoClient(
	cfg: Config["zoho"],
	fetchImpl: typeof fetch = fetch,
): ZohoClient {
	const doFetch = withTimeout(fetchImpl);
	const configured = Boolean(
		cfg.enabled && cfg.clientId && cfg.clientSecret && cfg.refreshToken,
	);

	let cache: TokenCache | null = null;
	let inFlight: Promise<string> | null = null;

	async function refresh(): Promise<string> {
		const url = new URL(`${cfg.accountsUrl}/oauth/v2/token`);
		url.searchParams.set("refresh_token", cfg.refreshToken!);
		url.searchParams.set("client_id", cfg.clientId!);
		url.searchParams.set("client_secret", cfg.clientSecret!);
		url.searchParams.set("grant_type", "refresh_token");
		const res = await doFetch(url.toString(), { method: "POST" });
		if (!res.ok) {
			throw new ZohoError(
				`OAuth refresh failed: ${res.status} ${await res.text()}`,
				res.status,
			);
		}
		// Zoho reports OAuth failures as HTTP 200 with an `error` body, so the
		// status check above never catches them — surface the reason
		// ("invalid_client", "invalid_code", rate-limit text) instead of a bare
		// "no access_token".
		const data = (await res.json().catch(() => ({}))) as {
			access_token?: string;
			expires_in?: number;
			error?: string;
		};
		if (!data.access_token) {
			throw new ZohoError(
				`OAuth returned no access_token${data.error ? `: ${data.error}` : ""}`,
			);
		}
		// A missing, malformed or implausibly short `expires_in` must not produce a
		// NaN deadline (cached forever) or a sub-second one (refresh per request).
		// The 401 retry below is what makes an over-long guess safe.
		const stated = Number(data.expires_in);
		const ttlSec =
			Number.isFinite(stated) && stated > 0
				? Math.max(60, stated - REFRESH_MARGIN_SEC)
				: FALLBACK_TTL_SEC;
		cache = { token: data.access_token, expiresAt: Date.now() + ttlSec * 1000 };
		return cache.token;
	}

	async function accessToken(): Promise<string> {
		if (cache && cache.expiresAt > Date.now()) return cache.token;
		// Concurrent cold callers share one grant rather than racing into several.
		inFlight ??= refresh().finally(() => {
			inFlight = null;
		});
		return inFlight;
	}

	async function authedFetch(
		path: string,
		init?: RequestInit,
	): Promise<Response> {
		const send = async () => {
			const token = await accessToken();
			return doFetch(`${cfg.baseUrl}${path}`, {
				...init,
				headers: {
					...(init?.headers ?? {}),
					Authorization: `Zoho-oauthtoken ${token}`,
				},
			});
		};
		const res = await send();
		if (res.status !== 401) return res;
		cache = null;
		return send();
	}

	/** Throws unless Zoho is fully configured — the CRM routes must fail closed. */
	function requireConfigured(): void {
		if (!configured) throw new ZohoError("Zoho CRM is not configured");
	}

	function requireRecordId(id: string): string {
		if (!RECORD_ID.test(id)) throw new ZohoError(`Invalid Zoho record id`);
		return encodeURIComponent(id);
	}

	return {
		async findLead(mobile) {
			// Deliberately fail-open: this only decides `lead` vs `unknown` on the
			// login path, and a CRM outage must not block a login.
			if (!configured) return false;
			try {
				const q = new URLSearchParams({ phone: mobile });
				const res = await authedFetch(`/crm/v3/Leads/search?${q}`);
				if (!res.ok) return false;
				const json = (await res.json().catch(() => ({}))) as {
					data?: unknown[];
				};
				return Array.isArray(json.data) && json.data.length > 0;
			} catch {
				return false;
			}
		},

		async getLead(id) {
			requireConfigured();
			const safeId = requireRecordId(id);
			const res = await authedFetch(`/crm/v3/Leads/${safeId}`);
			if (res.status === 204 || res.status === 404) return null;
			if (!res.ok) {
				throw new ZohoError(
					`getLead failed: ${res.status} ${await res.text()}`,
					res.status,
				);
			}
			const json = (await res.json().catch(() => ({}))) as {
				data?: ZohoLead[];
			};
			return json.data?.[0] ?? null;
		},

		async updateLead(id, fields) {
			requireConfigured();
			const safeId = requireRecordId(id);
			// No `trigger` key: omitting it leaves Zoho's workflows and assignment
			// rules running, which is what sales' automation expects.
			const res = await authedFetch(`/crm/v3/Leads/${safeId}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ data: [fields] }),
			});
			if (!res.ok) {
				throw new ZohoError(
					`updateLead failed: ${res.status} ${await res.text()}`,
					res.status,
				);
			}
			// Zoho answers 200 with per-record outcomes inside, so a bad field or a
			// validation rule looks like success until this is read.
			const json = (await res.json().catch(() => ({}))) as {
				data?: { code?: string; message?: string }[];
			};
			const row = json.data?.[0];
			if (row?.code !== "SUCCESS") {
				throw new ZohoError(
					`updateLead rejected: ${row?.code ?? "no result"} ${row?.message ?? ""}`.trim(),
				);
			}
		},
	};
}
