import type { Config } from "../config";
import type { EkoProfile, ProfileResult } from "../types";
import {
	mapAccounts,
	selectEvalueAccountId,
	type AccountDetail,
} from "./accounts";
import { withTimeout } from "./http";

/**
 * The response envelope `/authentication/login` and `/authentication/token`
 * return. Modelled on `connect-api/routes/authentication.js` — note the login
 * envelope answers HTTP 200 for *every* outcome including a wrong OTP, so the
 * status code says nothing about success.
 */
export interface ConnectLoginEnvelope {
	/** Wrong/expired OTP. Arrives with HTTP 200 (`verify_otp.js`). */
	otpFailed?: boolean;
	/** Upstream 2123 — authenticated, but the account is disabled. */
	accountInactive?: boolean;
	response_type_id?: number;
	access_token?: string;
	refresh_token?: string;
	/**
	 * Reduced-scope access token (`{org_id, is_org_admin, user_id, code,
	 * eko_user_id, user_type, email}` — `authentication.js:1044`). This is the
	 * only token the Connect widget reads for transaction calls, and the only one
	 * this service ever hands to a browser. See `mountConnect`.
	 */
	access_token_lite?: string;
	/** CRM-scoped token (`{org_id, zoho_id}` — `authentication.js:1055`). */
	access_token_crm?: string;
	/** Access-token lifetime in SECONDS (`ACCESS_TTL_MINS * 60`). */
	token_expiration?: number;
	long_session?: boolean;
	/** `auth_details` — the flattened user profile. */
	details?: Record<string, unknown>;
	account_details?: AccountDetail;
}

export interface ConnectTokens {
	accessToken: string;
	refreshToken: string;
	/** Reduced-scope token for the browser-side Connect widget. May be absent. */
	accessTokenLite?: string;
	/** CRM-scoped token, used only by the widget's deal-stage ping. May be absent. */
	accessTokenCrm?: string;
	/** Access-token lifetime in seconds, already clamped. */
	accessTtlSec: number;
	/** Refresh-window lifetime in seconds, derived from `long_session`. */
	sessionTtlSec: number;
}

export interface ConnectClient {
	sendOtp(input: {
		mobile: string;
		xRealIp?: string;
	}): Promise<{ ok: boolean; otp?: string }>;
	login(input: {
		mobile: string;
		otp: string;
		xRealIp?: string;
	}): Promise<ConnectLoginEnvelope>;
	refreshTokens(refreshToken: string): Promise<ConnectTokens | null>;
	revoke(refreshToken: string): Promise<void>;
	/**
	 * The role-scoped interaction list backing the Connect widget's
	 * `role_trxn_list`. One call returns every interaction the caller's role may
	 * run — there is no per-interaction lookup.
	 * @param accessToken - The caller's FULL upstream access token; the lite token
	 *   is not accepted here.
	 */
	interactions(
		accessToken: string,
		opts?: { xRealIp?: string },
	): Promise<unknown[]>;
	/**
	 * Runs a plain interaction and returns its envelope, for the support-ticket
	 * routes. Kept generic rather than one method per interaction id: the fields
	 * are validated at the trust boundary in `mountConnect`, not here.
	 * @param accessToken - The caller's FULL upstream access token.
	 * @param body - The interaction fields, already validated.
	 */
	interact(
		accessToken: string,
		body: Record<string, unknown>,
		opts?: { xRealIp?: string },
	): Promise<Record<string, unknown>>;
	/**
	 * Runs an interaction that carries files, over `/transactions/upload`.
	 *
	 * That transport has a convention of its own: every field travels URL-encoded
	 * inside a single `formdata` part, and the files are sibling parts named
	 * however the interaction expects (`file1`, `file2`, … for KYC documents).
	 * It is NOT a general multipart form.
	 * @param accessToken - The caller's FULL upstream access token.
	 * @param fields - The interaction fields, already validated.
	 * @param files - The files, already named for the upstream.
	 */
	uploadInteraction(
		accessToken: string,
		fields: Record<string, string>,
		files: Array<{ name: string; file: File }>,
		opts?: { xRealIp?: string },
	): Promise<Record<string, unknown>>;
	/**
	 * Creates a support ticket, with attachments when there are any.
	 *
	 * Attachments route through `uploadInteraction`; a ticket with none is a plain
	 * `/transactions/do` call.
	 * @param accessToken - The caller's FULL upstream access token.
	 * @param fields - The interaction fields.
	 * @param files - Attachments, already named for the upstream.
	 */
	createSupportTicket(
		accessToken: string,
		fields: Record<string, string>,
		files: Array<{ name: string; file: File }>,
		opts?: { xRealIp?: string },
	): Promise<Record<string, unknown>>;
}

/**
 * connect-api's own session windows (`config/app_config.js`), mirrored here so a
 * KV entry never outlives the upstream session it describes.
 */
const SESSION_TTL_SEC = 480 * 60; // SESSION_TTL_MINS 480 (8 h)
const LONG_SESSION_TTL_SEC = 43200 * 60; // LONG_SESSION_TTL_MINS 43200 (30 d)

/**
 * Ceiling for a self-reported `token_expiration`, and the value assumed when it
 * is missing or unparseable. connect-api's `ACCESS_TTL_MINS` is 300 (5 h); a
 * larger claim is not trusted, and an absent one degrades to a short window so
 * the next refresh comes round sooner rather than never.
 */
const MAX_ACCESS_TTL_SEC = 300 * 60;
const FALLBACK_ACCESS_TTL_SEC = 300;

/**
 * `auth_details.user_type` for a mobile connect-api has no EPS account for. It
 * mints an anonymous session (`user_id: '-1'`) rather than refusing the login.
 */
const NEW_USER_TYPE = "-1";

/** The EPS business-partner `user_type`. Everything else is an Eloka-side user. */
const EPS_BUSINESS_USER_TYPE = "23";

/** Normalizes `token_expiration`, which arrives as a number, a numeric string, or not at all. */
function accessTtlOf(env: ConnectLoginEnvelope): number {
	const raw = Number(env.token_expiration);
	if (!Number.isFinite(raw) || raw <= 0) return FALLBACK_ACCESS_TTL_SEC;
	return Math.min(raw, MAX_ACCESS_TTL_SEC);
}

/**
 * Extracts the upstream token pair, or null when connect-api minted no session
 * (a rejected OTP, or an unrecognized envelope).
 */
export function tokensOf(env: ConnectLoginEnvelope): ConnectTokens | null {
	const accessToken = env.access_token;
	const refreshToken = env.refresh_token;
	if (!accessToken || !refreshToken) return null;
	return {
		accessToken,
		refreshToken,
		// Optional on purpose: absent lite/crm must not invalidate a session that
		// is otherwise fine. Only the widget needs them, and it degrades to a
		// failed CRM ping rather than a broken login.
		accessTokenLite: env.access_token_lite,
		accessTokenCrm: env.access_token_crm,
		accessTtlSec: accessTtlOf(env),
		sessionTtlSec: env.long_session ? LONG_SESSION_TTL_SEC : SESSION_TTL_SEC,
	};
}

/**
 * Maps `auth_details` onto the same `EkoProfile` the direct interaction-151 path
 * produces, so every downstream consumer is provider-agnostic.
 *
 * Two fields are shaped differently from the raw 151 `user_detail`:
 * `role_list` arrives comma-joined (`detail.role_list.sort().join(',')`), and
 * the Zoho id is `zoho_id` rather than `crm_contact_id`. `eko_user_id` is not in
 * this envelope at all; it is cosmetic in `MeView` and never an identity input
 * (`identityOf` uses the mobile), so an empty string is correct rather than a gap.
 */
function mapConnectProfile(
	d: Record<string, unknown>,
	accountDetail?: AccountDetail,
): EkoProfile {
	const roles = d.role_list;
	return {
		accounts: mapAccounts(accountDetail),
		evalueAccountId: selectEvalueAccountId(accountDetail),
		name: String(d.name ?? ""),
		email: String(d.email ?? ""),
		mobile: String(d.mobile ?? ""),
		code: (d.code as number | string) ?? "",
		userType: String(d.user_type ?? ""),
		ekoUserId: String(d.eko_user_id ?? ""),
		roleList: Array.isArray(roles)
			? roles.map((r) => String(r))
			: String(roles ?? "")
					.split(",")
					.map((r) => r.trim())
					.filter(Boolean),
		orgId: Number(d.org_id ?? 1),
		dateOfJoining: d.date_of_joining ? String(d.date_of_joining) : undefined,
		onboarding: Number(d.onboarding ?? 0),
		zohoId: String(d.zoho_id ?? d.crm_contact_id ?? ""),
		onboardingSteps: Array.isArray(d.onboarding_steps)
			? (d.onboarding_steps as Array<Record<string, unknown>>).map((s) => ({
					role: Number(s?.role ?? -1),
					label: String(s?.label ?? ""),
				}))
			: [],
	};
}

/**
 * Classifies a connect-api login envelope into the same `ProfileResult` union
 * `eko.getProfile` returns.
 *
 * Reads the envelope only — never connect-api's JWT. Every comparison coerces
 * first (`Number`/`String`), because these fields cross a JSON boundary owned by
 * another codebase and arrive as numbers in some branches and strings in others.
 *
 * The branch ORDER is load-bearing and mirrors `clients/eko.ts`:
 *
 * 1. `accountInactive` — authenticated but disabled; no session at any tier.
 * 2. `user_type === "-1"` — connect-api's anonymous session for a mobile with no
 *    EPS account. Must be read from `user_type`, NOT `role_list`: connect-api
 *    unconditionally overwrites the role to `[-5]` for every mobile login
 *    (`routes/authentication.js:791`), discarding the `[-2]` API-partner value,
 *    so the role says nothing about who this is.
 * 3. `onboarding === 1` BEFORE the business-partner gate — `user_type` flips to
 *    "23" the instant the partial account exists, so gating on it first would
 *    classify every mid-onboarding user `not_allowed` and lock them out of
 *    resuming on their next login.
 * 4. The business-partner gate. connect-api authenticates the entire Eloka user
 *    base — retailers, distributors, agents. Without this check any of them
 *    would hold a developer session on the EPS portal.
 */
export function mapConnectLogin(
	env: ConnectLoginEnvelope,
	expectedOrgId: number,
): ProfileResult {
	const code = Number(env.response_type_id ?? 0);
	if (env.accountInactive) return { kind: "inactive", responseTypeId: code };

	const d = env.details;
	if (!d) return { kind: "error", responseTypeId: code };

	const userType = String(d.user_type ?? "");
	// New user: connect-api substitutes a placeholder profile (`mobile: '1'`), so
	// this must be decided before the mobile sanity-check below.
	if (userType === NEW_USER_TYPE || String(d.user_id ?? "") === NEW_USER_TYPE) {
		return { kind: "not_found", responseTypeId: code };
	}

	// A profile with no mobile is an upstream anomaly, not a classification: the
	// mobile is the `initiator_id` on every later interaction (`identityOf`), and
	// both `found` and `onboarding` hand this profile out as an identity.
	if (!String(d.mobile ?? "").trim()) {
		return { kind: "error", responseTypeId: code };
	}

	if (Number(d.onboarding ?? 0) === 1) {
		return {
			kind: "onboarding",
			responseTypeId: code,
			profile: mapConnectProfile(d, env.account_details),
		};
	}

	if (
		Number(d.org_id ?? 0) !== expectedOrgId ||
		userType !== EPS_BUSINESS_USER_TYPE
	) {
		return { kind: "not_allowed", responseTypeId: code };
	}

	return {
		kind: "found",
		responseTypeId: code,
		profile: mapConnectProfile(d, env.account_details),
	};
}

/**
 * A thin client for connect-api's `/authentication/*` and `/transactions/*`
 * endpoints.
 *
 * This client is server-to-server. The browser used to have no reason to reach
 * connect-api at all — but the embedded Connect widget (`ConnectWidget.tsx`)
 * calls it directly, using an API base URL baked into its own bundle, so
 * connect-api's CORS allowlist (`ACCESS_ORIGINS`) DOES need an entry for the
 * console origin. That is a prerequisite outside this repo; see
 * docs/features/connect-widget.md.
 */
export function createConnectClient(
	cfg: NonNullable<Config["connectApi"]>,
	fetchImpl: typeof fetch = fetch,
): ConnectClient {
	const doFetch = withTimeout(fetchImpl, cfg.timeoutMs);
	const base = cfg.baseUrl.replace(/\/+$/, "");

	async function post(
		path: string,
		body: Record<string, unknown>,
		opts: { xRealIp?: string; bearer?: string } = {},
	): Promise<unknown> {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};
		// Forward the trusted proxy-set client IP so connect-api's logging and any
		// upstream anti-abuse see the real caller rather than this server.
		if (opts.xRealIp) headers["X-Real-IP"] = opts.xRealIp;
		if (opts.bearer) headers.Authorization = `Bearer ${opts.bearer}`;
		const res = await doFetch(`${base}${path}`, {
			method: "POST",
			headers,
			body: JSON.stringify(body),
		});
		const text = await res.text();
		let parsed: unknown;
		try {
			parsed = JSON.parse(text);
		} catch {
			throw new Error(
				`connect-api returned non-JSON from ${path} (status ${res.status})`,
			);
		}
		// connect-api answers 200 for business-level failures (wrong OTP, inactive
		// account) and reserves non-2xx for transport/server faults, so the status
		// check is about reachability only — the envelope decides the outcome.
		if (!res.ok) {
			throw new Error(`connect-api HTTP ${res.status} from ${path}`);
		}
		return parsed;
	}

	/**
	 * Posts a `multipart/form-data` body, for the upload transport. The boundary
	 * header is left to `fetch`, which derives it from the `FormData`.
	 */
	async function postMultipart(
		path: string,
		form: FormData,
		opts: { xRealIp?: string; bearer?: string } = {},
	): Promise<unknown> {
		const headers: Record<string, string> = {};
		if (opts.xRealIp) headers["X-Real-IP"] = opts.xRealIp;
		if (opts.bearer) headers.Authorization = `Bearer ${opts.bearer}`;
		const res = await doFetch(`${base}${path}`, {
			method: "POST",
			headers,
			body: form,
		});
		const text = await res.text();
		if (!res.ok) {
			throw new Error(`connect-api HTTP ${res.status} from ${path}`);
		}
		try {
			return JSON.parse(text);
		} catch {
			throw new Error(
				`connect-api returned non-JSON from ${path} (status ${res.status})`,
			);
		}
	}

	/**
	 * Runs an interaction over the upload transport. Shared by every caller that
	 * has files, so the `formdata` convention lives in exactly one place.
	 */
	async function uploadInteraction(
		accessToken: string,
		fields: Record<string, string>,
		files: Array<{ name: string; file: File }>,
		opts: { xRealIp?: string } = {},
	): Promise<Record<string, unknown>> {
		const form = new FormData();
		// One `formdata` part carrying every field URL-encoded — how connect-api's
		// upload endpoint expects them, not a part per field.
		form.append("formdata", new URLSearchParams(fields).toString());
		for (const { name, file } of files) form.append(name, file, file.name);

		const raw = await postMultipart("/transactions/upload", form, {
			bearer: accessToken,
			xRealIp: opts.xRealIp,
		});
		return (raw ?? {}) as Record<string, unknown>;
	}

	return {
		uploadInteraction,

		async sendOtp({ mobile, xRealIp }) {
			const raw = (await post(
				"/authentication/sendotp",
				{
					mobile,
					platform: "web",
					app: "EPS",
					org_id: cfg.orgId,
				},
				{ xRealIp },
			)) as { response_status_id?: number; data?: { otp?: string } };
			return { ok: Number(raw?.response_status_id) === 0, otp: raw?.data?.otp };
		},

		async login({ mobile, otp, xRealIp }) {
			// `api_partner_signup` is deliberately NOT sent: connect-api overrides
			// the role to [-5] for every mobile login anyway (authentication.js:791),
			// so it would be a no-op that implies a guarantee we do not get.
			return (await post(
				"/authentication/login",
				{
					id_type: "Mobile",
					mobile,
					id_token: otp,
					platform: "web",
					org_id: cfg.orgId,
				},
				{ xRealIp },
			)) as ConnectLoginEnvelope;
		},

		async refreshTokens(refreshToken) {
			const env = (await post("/authentication/token", {
				refresh_token: refreshToken,
			})) as ConnectLoginEnvelope;
			return tokensOf(env);
		},

		async revoke(refreshToken) {
			await post("/authentication/revoke", { refresh_token: refreshToken });
		},

		async interactions(accessToken, opts = {}) {
			// `source: "WLC"` and a `client_ref_id` are what Eloka's shared fetcher
			// adds to every connect-api call; the endpoint expects both.
			const raw = await post(
				"/transactions/wlc",
				{ source: "WLC", client_ref_id: `eps-${Date.now()}` },
				{ bearer: accessToken, xRealIp: opts.xRealIp },
			);
			// Shape varies across connect-api versions: a bare array in some, wrapped
			// in `data` in others. Normalize rather than trust one of them.
			if (Array.isArray(raw)) return raw;
			const data = (raw as { data?: unknown })?.data;
			return Array.isArray(data) ? data : [];
		},

		async interact(accessToken, body, opts = {}) {
			const raw = await post("/transactions/do", body, {
				bearer: accessToken,
				xRealIp: opts.xRealIp,
			});
			return (raw ?? {}) as Record<string, unknown>;
		},

		async createSupportTicket(accessToken, fields, files, opts = {}) {
			// A ticket with no attachment has nothing to upload, and the plain
			// interaction endpoint is the cheaper transport for it.
			if (!files.length) {
				const raw = await post("/transactions/do", fields, {
					bearer: accessToken,
					xRealIp: opts.xRealIp,
				});
				return (raw ?? {}) as Record<string, unknown>;
			}
			return uploadInteraction(accessToken, fields, files, opts);
		},
	};
}
