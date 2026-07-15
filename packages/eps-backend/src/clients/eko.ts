import { randomUUID } from "node:crypto";
import { type EkoLogger, noopEkoLogger } from "../audit/ekoLog";
import type { Config } from "../config";
import type { EkoProfile, ProfileResult } from "../types";
import { withTimeout } from "./http";

export interface EkoClient {
	sendOtp(input: {
		mobile: string;
		orgId?: number;
		platform?: string;
		app?: string;
		clientRefId?: string;
		source?: string;
		xRealIp?: string;
	}): Promise<{ ok: boolean; raw: unknown }>;
	verifyOtp(input: {
		mobile: string;
		otp: string;
		orgId?: number;
		clientRefId?: string;
		source?: string;
		xRealIp?: string;
	}): Promise<{ ok: boolean; raw: unknown }>;
	getProfile(input: {
		mobile: string;
		orgId?: number;
		xRealIp?: string;
	}): Promise<ProfileResult>;
	createPartialAccount(input: {
		mobile: string;
		xRealIp?: string;
	}): Promise<EkoStepResult>;
	verifyPan(input: {
		pan: string;
		identity: EkoIdentity;
		xRealIp?: string;
	}): Promise<EkoStepResult>;
	getBooklet(input: {
		identity: EkoIdentity;
		xRealIp?: string;
	}): Promise<EkoBooklet | null>;
	fetchPintwinKey(input: {
		mobile: string;
		identity: EkoIdentity;
		xRealIp?: string;
	}): Promise<EkoPintwinKey | null>;
	setSecretPin(input: {
		firstOkekey: string;
		secondOkekey: string;
		booklet: EkoBooklet;
		identity: EkoIdentity;
		xRealIp?: string;
	}): Promise<EkoStepResult>;
}

const NOT_FOUND_CODES = new Set([319, 1200, 1867]);
const INACTIVE_CODE = 2123;
const SUCCESS_CODE = 369;

/**
 * Fixed geo-coordinates sent with onboarding interactions.
 *
 * This flow does not capture the user's location — the Eloka geolocation step
 * is deliberately not ported — but upstream expects the field. Eloka itself
 * falls back to this exact value when its capture step is skipped.
 */
const ONBOARDING_LATLONG = "27.176670,78.008075,7787";

/** Upstream `response_type_id` values that mean a step succeeded. */
const CREATE_PARTIAL_ACCOUNT_OK = 1566;
const PAN_VERIFICATION_OK = 1569;
const BOOKLET_OK = 1646;
const SECRET_PIN_OK = 9;

/**
 * Identity of the acting user for an onboarding interaction.
 *
 * Before the partial account exists, this is the configured DEFAULT pair.
 * Afterwards it is the user's own `ekoUserId` / `code` from the 151 profile.
 * `user_id` is never sent upstream.
 */
export interface EkoIdentity {
	initiatorId: string;
	userCode: string;
	orgId: number;
}

/** Booklet details from interaction 170, forwarded verbatim to interaction 5. */
export interface EkoBooklet {
	bookletSerialNumber: string;
	isPintwinUser: number;
}

/** A single-use substitution key from interaction 10005. */
export interface EkoPintwinKey {
	pintwinKey: string;
	keyId: number | string;
}

/** Outcome of an onboarding interaction, carrying the upstream message on failure. */
export type EkoStepResult =
	| { ok: true }
	| { ok: false; message: string; responseTypeId: number };

export function createEkoClient(
	cfg: Config["eko"],
	fetchImpl: typeof fetch = fetch,
	logger: EkoLogger = noopEkoLogger,
): EkoClient {
	const url = `${cfg.scheme}://${cfg.host}:${cfg.port}${cfg.path}`;
	const doFetch = withTimeout(fetchImpl);

	/**
	 * Shared send/log/error pipeline for both the urlencoded (`post`) and
	 * multipart (`postMultipart`) transports: forwards `X-Real-IP`, times the
	 * call, reads the body BEFORE the status check (a non-2xx often carries a
	 * diagnostic JSON payload worth capturing), logs one entry via `logger.log`
	 * keyed by the logical `fields` (never the raw body), and throws on a
	 * non-2xx or non-JSON response.
	 */
	async function sendForm(
		body: string | FormData,
		headers: Record<string, string>,
		fields: Record<string, string>,
		xRealIp?: string,
	): Promise<unknown> {
		// Forward the trusted client IP so the upstream's own anti-abuse / rate
		// checks see the real caller. Omit the header entirely when unknown — an
		// empty `X-Real-IP` can be treated differently from an absent one upstream.
		if (xRealIp) headers["X-Real-IP"] = xRealIp;

		const start = performance.now();
		let res: Response;
		try {
			res = await doFetch(url, { method: "POST", headers, body });
		} catch (e) {
			// Transport failure (timeout / connection refused): still log, then rethrow.
			logger.log({
				fields,
				error: e instanceof Error ? e.message : String(e),
				durMs: Math.round(performance.now() - start),
			});
			throw e;
		}

		// Read the body BEFORE the status check so an upstream error body is logged
		// (a non-2xx often carries a diagnostic JSON payload worth capturing).
		const text = await res.text();
		let parsed: unknown;
		let parseError = false;
		try {
			parsed = JSON.parse(text);
		} catch {
			parseError = true;
		}
		logger.log({
			fields,
			status: res.status,
			response: parseError ? { nonJson: text.slice(0, 500) } : parsed,
			error: parseError ? "non-JSON response body" : undefined,
			durMs: Math.round(performance.now() - start),
		});

		if (!res.ok) {
			throw new Error(`Eko upstream HTTP ${res.status}`);
		}
		if (parseError) {
			throw new Error(`Eko upstream returned non-JSON (status ${res.status})`);
		}
		return parsed;
	}

	async function post(
		fields: Record<string, string>,
		xRealIp?: string,
	): Promise<unknown> {
		const body = new URLSearchParams(fields).toString();
		const headers: Record<string, string> = {
			"Content-Type": "application/x-www-form-urlencoded",
			developer_key: cfg.developerKey,
		};
		return sendForm(body, headers, fields, xRealIp);
	}

	/**
	 * POSTs a single `multipart/form-data` part named `form-data`, whose value
	 * is the given URL-encoded field string. Interaction 523 (PAN verification)
	 * is the one onboarding call the upstream expects wrapped this way instead
	 * of plain urlencoded — see the design spec's "PAN (523)" section.
	 *
	 * `Content-Type` is deliberately left unset: `fetch` fills in the multipart
	 * boundary itself once it sees a `FormData` body, and setting it manually
	 * would omit that boundary and break the upload.
	 */
	async function postMultipart(
		formDataString: string,
		xRealIp?: string,
	): Promise<unknown> {
		const body = new FormData();
		body.append("form-data", formDataString);
		const headers: Record<string, string> = { developer_key: cfg.developerKey };
		// Logged fields must mirror the actual wire values so redaction and the
		// `basic`-level summary keep working exactly as they do for `post()`.
		const fields = Object.fromEntries(new URLSearchParams(formDataString));
		return sendForm(body, headers, fields, xRealIp);
	}

	function base(orgId?: number): Record<string, string> {
		return {
			initiator_id: cfg.initiatorId,
			user_code: cfg.userCode,
			org_id: String(orgId ?? cfg.defaultOrgId),
		};
	}

	/** Form fields identifying the acting user on an onboarding interaction. */
	function actor(identity: EkoIdentity): Record<string, string> {
		return {
			initiator_id: identity.initiatorId,
			user_code: identity.userCode,
			org_id: String(identity.orgId),
		};
	}

	/** Classifies a step response against its expected success `response_type_id`. */
	function stepResult(raw: unknown, successTypeId: number): EkoStepResult {
		const r = raw as { response_type_id?: number; message?: string };
		const code = Number(r?.response_type_id ?? -1);
		if (code === successTypeId) return { ok: true };
		return {
			ok: false,
			message: r?.message ?? "The request could not be completed.",
			responseTypeId: code,
		};
	}

	return {
		async sendOtp(input) {
			const raw = (await post(
				{
					...base(input.orgId),
					interaction_type_id: "515",
					mobile: input.mobile,
					app: input.app ?? "eps",
					platform: input.platform ?? "web",
					source: input.source ?? "EPSBACKEND",
					intent_id: "0",
					user_identity: input.mobile,
					user_identity_type: "mobile_number",
					client_ref_id: input.clientRefId ?? "",
				},
				input.xRealIp,
			)) as { response_status_id?: number };
			return { ok: raw?.response_status_id === 0, raw };
		},
		async verifyOtp(input) {
			const raw = (await post(
				{
					...base(input.orgId),
					interaction_type_id: "518",
					otp: input.otp,
					mobile: input.mobile,
					source: input.source ?? "EPSBACKEND",
					intent_id: "0",
					verification_type: "2",
					user_identity: input.mobile,
					user_identity_type: "mobile_number",
					client_ref_id: input.clientRefId ?? "",
				},
				input.xRealIp,
			)) as { response_status_id?: number };
			return { ok: raw?.response_status_id === 0, raw };
		},
		async getProfile(input) {
			const raw = (await post(
				{
					...base(input.orgId),
					interaction_type_id: "151",
					user_identity: input.mobile,
					user_identity_type: "mobile_number",
				},
				input.xRealIp,
			)) as {
				response_type_id?: number;
				response_code?: number;
				data?: { user_detail?: Record<string, unknown> };
			};
			// Classify ONLY by response_type_id (mirrors authentication.js).
			// The upstream's response_status_id is NOT a success flag here: it is
			// -1 for a found profile and 1 for a not-found user, so gating on it
			// would wrongly reject real logins. `response_code` is an alternate
			// spelling of the type id on some responses.
			const code = Number(raw?.response_type_id ?? raw?.response_code ?? -1);
			if (code === INACTIVE_CODE)
				return { kind: "inactive", responseTypeId: code };
			// 319 / 1200 / 1867 → user not registered in this org (new user).
			// NB: 319's upstream message is "Invalid Sender/Initiator", which reads
			// like an auth error but means MERCHANT_NOT_FOUND.
			if (NOT_FOUND_CODES.has(code))
				return { kind: "not_found", responseTypeId: code };
			const d = raw?.data?.user_detail;
			if (code === SUCCESS_CODE && d) {
				// Onboarding-in-progress is checked FIRST and deliberately: user_type
				// flips to "23" as soon as the partial account exists, so it cannot
				// tell an in-progress user from a finished one. `onboarding === 1` is
				// the only reliable signal. Gating on user_type first would classify
				// every mid-onboarding user as not_allowed and lock them out on every
				// subsequent login.
				if (Number(d.onboarding ?? 0) === 1) {
					return {
						kind: "onboarding",
						responseTypeId: code,
						profile: mapProfile(d),
					};
				}
				// Check if the user matches EPS Business partner type (orgId == 1 && userType == "23"). If not, treat as an invalid user (not_allowed) so the caller does not mint a session for a non-business user.
				if (Number(d.org_id ?? 0) !== 1 || String(d.user_type ?? "") !== "23") {
					return { kind: "not_allowed", responseTypeId: code };
				}

				return {
					kind: "found",
					responseTypeId: code,
					profile: mapProfile(d),
				};
			}
			// Unrecognized response (mirror reference's "else -> 500"): a hard
			// error, so the caller never mints a session on an unclassified result.
			return { kind: "error", responseTypeId: code };
		},
		async createPartialAccount(input) {
			// The account does not exist yet, so the configured DEFAULT initiator /
			// user_code pair acts on the new user's behalf, identified by mobile.
			const raw = await post(
				{
					...base(),
					interaction_type_id: "521",
					user_identity: input.mobile,
					user_identity_type: "mobile_number",
					csp_id: input.mobile,
					applicant_type: "1",
					business_vertical: "EPS",
					latlong: ONBOARDING_LATLONG,
					source: "EPS",
				},
				input.xRealIp,
			);
			return stepResult(raw, CREATE_PARTIAL_ACCOUNT_OK);
		},
		async verifyPan(input) {
			// PAN rides as `doc_id` on the document interaction; no photo is sent.
			// Unlike every other onboarding interaction, 523 (document upload) is
			// NOT sent as a flat urlencoded body: the reference connect-api
			// implementation wraps it in one multipart part, literally named
			// `form-data`, whose value is this same URL-encoded field string. See
			// the design spec's "PAN (523)" section.
			const fields = {
				client_ref_id: randomUUID(),
				interaction_type_id: "523",
				intent_id: "3",
				doc_type: "2",
				doc_id: input.pan,
				source: "EPS",
				latlong: ONBOARDING_LATLONG,
				...actor(input.identity),
			};
			const raw = await postMultipart(
				new URLSearchParams(fields).toString(),
				input.xRealIp,
			);
			return stepResult(raw, PAN_VERIFICATION_OK);
		},
		async getBooklet(input) {
			const raw = (await post(
				{
					...actor(input.identity),
					interaction_type_id: "170",
					document_id: "",
					latlong: ONBOARDING_LATLONG,
				},
				input.xRealIp,
			)) as {
				response_status_id?: number;
				response_type_id?: number;
				data?: { booklet_serial_number?: string; is_pintwin_user?: number };
			};
			// This interaction reports success on BOTH ids; accept neither alone.
			if (
				Number(raw?.response_status_id ?? -1) !== 0 ||
				Number(raw?.response_type_id ?? -1) !== BOOKLET_OK
			) {
				return null;
			}
			return {
				bookletSerialNumber: String(raw.data?.booklet_serial_number ?? ""),
				isPintwinUser: Number(raw.data?.is_pintwin_user ?? 0),
			};
		},
		async fetchPintwinKey(input) {
			const raw = (await post(
				{
					...actor(input.identity),
					interaction_type_id: "10005",
					alternate_user_id: input.mobile,
				},
				input.xRealIp,
			)) as { data?: { pintwin_key?: string; key_id?: number | string } };
			const key = raw?.data?.pintwin_key;
			const keyId = raw?.data?.key_id;
			if (!key || keyId === undefined || keyId === null) return null;
			return { pintwinKey: String(key), keyId };
		},
		async setSecretPin(input) {
			// is_pintwin_user and booklet_serial_number are forwarded verbatim from
			// interaction 170 — they are interpreted upstream, not here.
			const raw = await post(
				{
					...actor(input.identity),
					interaction_type_id: "5",
					first_okekey: input.firstOkekey,
					second_okekey: input.secondOkekey,
					is_pintwin_user: String(input.booklet.isPintwinUser),
					booklet_serial_number: input.booklet.bookletSerialNumber,
					latlong: ONBOARDING_LATLONG,
				},
				input.xRealIp,
			);
			return stepResult(raw, SECRET_PIN_OK);
		},
	};
}

function mapProfile(d: Record<string, unknown>): EkoProfile {
	const roles = Array.isArray(d.role_list) ? d.role_list : [];
	return {
		name: String(d.name ?? ""),
		email: String(d.email ?? ""),
		mobile: String(d.mobile ?? ""),
		code: (d.code as number | string) ?? "",
		userType: String(d.user_type ?? ""),
		ekoUserId: String(d.eko_user_id ?? ""),
		roleList: roles.map((r) => String(r)),
		orgId: Number(d.org_id ?? 1),
		dateOfJoining: d.date_of_joining ? String(d.date_of_joining) : undefined,
		onboarding: Number(d.onboarding ?? 0),
		zohoId: String(d.crm_contact_id ?? ""),
		onboardingSteps: Array.isArray(d.onboarding_steps)
			? (d.onboarding_steps as Array<Record<string, unknown>>).map((s) => ({
					role: Number(s.role ?? -1),
					label: String(s.label ?? ""),
				}))
			: [],
	};
}
