import { noopEkoLogger, type EkoLogger } from "../audit/ekoLog";
import type { Config } from "../config";
import type { EkoProfile, ProfileResult, TransactionRow } from "../types";
import {
	mapAccounts,
	selectEvalueAccountId,
	type AccountDetail,
} from "./accounts";
import { clientRefId, withTimeout } from "./http";
import { stripSensitive, toStateId } from "./profile-fields";

export interface EkoClient {
	sendOtp(input: {
		mobile: string;
		orgId?: number;
		platform?: string;
		app?: string;
		source?: string;
		xRealIp?: string;
	}): Promise<{ ok: boolean; raw: unknown }>;
	verifyOtp(input: {
		mobile: string;
		otp: string;
		orgId?: number;
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
	submitBusiness(input: {
		details: BusinessDetails;
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
	getAgreementUrl(input: {
		mobile: string;
		identity: EkoIdentity;
		xRealIp?: string;
	}): Promise<SignUrlResult>;
	submitSignAgreement(input: {
		documentId: string;
		identity: EkoIdentity;
		xRealIp?: string;
	}): Promise<EkoStepResult>;
	getWalletBalance(input: {
		identity: EkoIdentity;
		xRealIp?: string;
	}): Promise<number | null>;
	getTransactionHistory(
		input: TransactionHistoryInput,
	): Promise<{ rows: TransactionRow[] }>;
}

/**
 * A page of this user's own transaction history.
 *
 * `accountId` comes from the caller's 151 profile via `selectEvalueAccountId`.
 * The route refuses the request when it cannot be resolved, so in practice this
 * is never null by the time it reaches upstream — the type keeps the null case
 * explicit rather than letting a missing account silently omit the filter and
 * return somebody else's default account.
 */
export interface TransactionHistoryInput {
	identity: EkoIdentity;
	accountId: string | null;
	startIndex: number;
	limit: number;
	/** Already allow-listed and shape-checked by the route — never raw query input. */
	filters: Record<string, string>;
	xRealIp?: string;
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
const BUSINESS_DETAILS_OK = 1567;

/**
 * Interaction 287: `response_type_id`s meaning the agreement is already signed —
 * skip the provider popup and go straight to the submit step (293).
 *
 * These carry no `short_url`, so they need their own branch. Success for the
 * agreement interactions is NOT a fixed `response_type_id`: a live 287 answers
 * `1043` ("Document Id From Digio") with a perfectly good Leegality URL, and 293
 * has answered both 1043 and 1069. `status` is the stable signal — 0 on success,
 * the error id otherwise (1083 "Invalid agreement id.", 1070 "Document not
 * verified successfully").
 */
const AGREEMENT_ALREADY_SIGNED = new Set([1615, 1069]);
/**
 * Agreement id sent to interactions 287/293. This is '4' in case of API (EPS) Partners.
 */
const AGREEMENT_ID = "4";

/**
 * Identity of the acting user on an interaction.
 *
 * Before the partial account exists, this is the configured DEFAULT pair.
 * Afterwards it is the user's own MOBILE / `code` from the 151 profile.
 *
 * `initiator_id` is the user's registered MOBILE NUMBER — not any internal id.
 * This mirrors connect-api, the live Eloka backend: its 151 login puts
 * `user_id: detail.mobile` in the JWT claim (routes/authentication.js), and
 * every later interaction sends `initiator_id = tokenDetails.user_id`, i.e. the
 * mobile (routes/transactions.js). `eko_user_id` rides in that claim too but is
 * never sent as `initiator_id` anywhere — so do not "fix" this back to
 * `ekoUserId`: upstream answers 403 "Invalid Sender/Initiator".
 * `user_id` itself is never sent upstream.
 */
export interface EkoIdentity {
	initiatorId: string;
	userCode: string;
	orgId: number;
}

/** The user's own identity, valid once the partial account exists. */
export function identityOf(profile: EkoProfile): EkoIdentity {
	return {
		initiatorId: profile.mobile,
		userCode: String(profile.code),
		orgId: profile.orgId,
	};
}

/** Booklet details from interaction 170, forwarded verbatim to interaction 5. */
export interface EkoBooklet {
	bookletSerialNumber: string;
	isPintwinUser: number;
}

/**
 * Business details collected by the onboarding step, keyed exactly as
 * interaction 522 expects them. Values are forwarded verbatim — this client
 * does not rename, trim, or re-validate them.
 */
export interface BusinessDetails {
	name: string;
	company_type: string;
	authorized_signatory_name: string;
	email: string;
	current_address_line1: string;
	current_address_line2: string;
	current_address_district: string;
	current_address_state: string;
	current_address_pincode: string;
}

/** A single-use substitution key from interaction 10005. */
export interface EkoPintwinKey {
	pintwinKey: string;
	keyId: number | string;
}

/**
 * The diagnostic sub-objects an upstream failure can carry beyond `message`.
 *
 * `message` alone is often useless — a missing field answers "Please provide
 * the value of the field" and names it only in `invalid_params`. Kept as an
 * open bag: the transaction framework adds keys (`dependent_params`,
 * `list_items`) without notice, and this layer only forwards them.
 */
export type EkoErrorDetails = Record<string, unknown>;

/** Upstream keys worth forwarding to the caller (and the log) on a failure. */
const DETAIL_KEYS = ["invalid_params", "dependent_params", "list_items"];

/** Picks the diagnostic sub-objects off an upstream reply, or undefined if none. */
export function errorDetails(raw: unknown): EkoErrorDetails | undefined {
	if (!raw || typeof raw !== "object") return undefined;
	const r = raw as Record<string, unknown>;
	const out: EkoErrorDetails = {};
	for (const k of DETAIL_KEYS) {
		const v = r[k];
		// Upstream sends `{}` / `[]` for "none" as often as it omits the key.
		if (v == null) continue;
		if (typeof v === "object" && Object.keys(v).length === 0) continue;
		out[k] = v;
	}
	return Object.keys(out).length > 0 ? out : undefined;
}

/** Outcome of an onboarding interaction, carrying the upstream message on failure. */
export type EkoStepResult =
	| { ok: true }
	| {
			ok: false;
			message: string;
			responseTypeId: number;
			details?: EkoErrorDetails;
	  };

/**
 * Outcome of fetching the e-sign URL (interaction 287).
 *
 * `alreadySigned` short-circuits the provider popup: the agreement is already
 * signed upstream, so only the submit step (293) remains.
 */
export type SignUrlResult =
	| {
			ok: true;
			shortUrl: string;
			documentId: string;
			pipe: number;
			alreadySigned: boolean;
	  }
	| {
			ok: false;
			message: string;
			responseTypeId: number;
			details?: EkoErrorDetails;
	  };

export function createEkoClient(
	cfg: Config["eko"],
	fetchImpl: typeof fetch = fetch,
	logger: EkoLogger = noopEkoLogger,
): EkoClient {
	const origin = `${cfg.scheme}://${cfg.host}:${cfg.port}`;
	const url = `${origin}${cfg.path}`;
	/**
	 * Interaction 154 (history) is a separate upstream — its own host, port and
	 * API version, resolved in `config.ts` (each part falls back to the main
	 * upstream). connect-api routes it the same way (`utils/url.js:70-99`).
	 */
	const historyUrl = cfg.historyUrl;
	const doFetch = withTimeout(fetchImpl, cfg.timeoutMs);

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
		target: string = url,
	): Promise<unknown> {
		// Forward the trusted client IP so the upstream's own anti-abuse / rate
		// checks see the real caller. Omit the header entirely when unknown — an
		// empty `X-Real-IP` can be treated differently from an absent one upstream.
		if (xRealIp) headers["X-Real-IP"] = xRealIp;

		const start = performance.now();
		let res: Response;
		try {
			res = await doFetch(target, { method: "POST", headers, body });
		} catch (e) {
			// Transport failure (timeout / connection refused): still log, then rethrow.
			logger.log({
				fields,
				path: target,
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
			// The target, not just the interaction id: interaction 154 posts to its
			// own host and API version, so a misconfigured SIMPLIBANK_HISTORY_API_*
			// is otherwise invisible in the log — the id says which call it was, the
			// URL says where it actually went.
			path: target,
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
		target: string = url,
	): Promise<unknown> {
		// Every interaction carries a client_ref_id, injected here rather than at
		// each call site so no future one can forget it — that omission is what
		// broke /authentication/login upstream. Generated, never caller-supplied,
		// so one request cannot replay another's reference.
		const withRef = { ...fields, client_ref_id: clientRefId() };
		const body = new URLSearchParams(withRef).toString();
		const headers: Record<string, string> = {
			"Content-Type": "application/x-www-form-urlencoded",
			developer_key: cfg.developerKey,
		};
		return sendForm(body, headers, withRef, xRealIp, target);
	}

	/**
	 * POSTs a single `multipart/form-data` part named `form-data`, whose value
	 * is the URL-encoded field string. Interaction 523 (PAN verification) is the
	 * one onboarding call the upstream expects wrapped this way instead of plain
	 * urlencoded — see the design spec's "PAN (523)" section.
	 *
	 * Takes the fields unencoded, like `post()`: the ref is injected before
	 * encoding, and the logged fields are the exact object that was serialized
	 * rather than a reparse of it.
	 *
	 * `Content-Type` is deliberately left unset: `fetch` fills in the multipart
	 * boundary itself once it sees a `FormData` body, and setting it manually
	 * would omit that boundary and break the upload.
	 *
	 * NOT the same convention as the documented file-upload APIs (see
	 * `MULTIPART_JSON_FIELD` in `src/lib/data/api-specs-common.ts`), which put a
	 * JSON object in this field. This one is URL-encoded and carries no files.
	 * Do not "align" them without confirming with Eko that 523 accepts JSON —
	 * PAN verification on every new signup runs through here.
	 */
	async function postMultipart(
		fields: Record<string, string>,
		xRealIp?: string,
	): Promise<unknown> {
		const withRef = { ...fields, client_ref_id: clientRefId() };
		const body = new FormData();
		body.append("form-data", new URLSearchParams(withRef).toString());
		const headers: Record<string, string> = { developer_key: cfg.developerKey };
		// Logged fields mirror the actual wire values, so redaction and the
		// `basic`-level summary keep working exactly as they do for `post()`.
		return sendForm(body, headers, withRef, xRealIp);
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
			details: errorDetails(raw),
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
				data?: {
					user_detail?: Record<string, unknown>;
					/**
					 * Sibling of `user_detail`, carrying the account list transaction
					 * history filters by. connect-api reads the same block
					 * (`routes/authentication.js:868`) and hands it to Eloka as
					 * `account_details`.
					 */
					account_detail?: AccountDetail;
					/**
					 * `data` carries further sibling blocks — `personal_detail`,
					 * `shop_detail`, … — which `mapProfile` copies out by name via
					 * `PROFILE_DETAIL_BLOCKS`. Left as an index signature rather than
					 * enumerated: the allowlist is the one place that decides which of
					 * them reach the browser.
					 */
					[block: string]: unknown;
				};
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
			const accountDetail = raw?.data?.account_detail;
			if (code === SUCCESS_CODE && d) {
				// A 369 with no mobile is an upstream anomaly, not a user
				// classification — reject it BEFORE either profile branch below.
				// `mobile` is load-bearing twice over: it is the `initiator_id` on
				// every later interaction (see `identityOf`), and both `found` AND
				// `onboarding` hand this profile out as an identity. Letting a blank
				// one through would send `initiator_id=` upstream and earn a 403
				// reading "Invalid Sender/Initiator" — an identity bug wearing an
				// auth bug's clothes. connect-api guards the same way: its success
				// branch requires `user_detail.mobile` and otherwise falls through to
				// its "unknown response → 500" (routes/authentication.js).
				if (!String(d.mobile ?? "").trim()) {
					return { kind: "error", responseTypeId: code };
				}
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
						profile: mapProfile(d, accountDetail, raw?.data),
					};
				}
				// Check if the user matches EPS Business partner type (orgId == 1 && userType == "23"). If not, treat as an invalid user (not_allowed) so the caller does not mint a session for a non-business user.
				// DEV_ALLOW_ANY_USER_TYPE skips the whole gate (org included) so any
				// test mobile can reach the console. Never true in production.
				if (
					!cfg.devAllowAnyUserType &&
					(Number(d.org_id ?? 0) !== 1 || String(d.user_type ?? "") !== "23")
				) {
					return { kind: "not_allowed", responseTypeId: code };
				}

				return {
					kind: "found",
					responseTypeId: code,
					profile: mapProfile(d, accountDetail, raw?.data),
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
			// `form-data`, whose value is the URL-encoded field string. See the
			// design spec's "PAN (523)" section.
			const raw = await postMultipart(
				{
					interaction_type_id: "523",
					intent_id: "3",
					doc_type: "2",
					doc_id: input.pan,
					source: "EPS",
					latlong: ONBOARDING_LATLONG,
					...actor(input.identity),
				},
				input.xRealIp,
			);
			return stepResult(raw, PAN_VERIFICATION_OK);
		},
		async submitBusiness(input) {
			// Eloka always sends a client_ref_id on this interaction — its
			// apiHelper injects one when absent (helpers/apiHelper.js:103) and its
			// pipeline sets one explicitly (executePipeline.ts:289). `post` does
			// the same for every interaction here.
			const raw = await post(
				{
					// `details` is spread FIRST so none of its keys can override the
					// system fields below (actor identity, interaction_type_id).
					...input.details,
					...actor(input.identity),
					interaction_type_id: "522",
					latlong: ONBOARDING_LATLONG,
					source: "EPS",
				},
				input.xRealIp,
			);
			return stepResult(raw, BUSINESS_DETAILS_OK);
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
		async getAgreementUrl(input) {
			// csp_id / user_id ride as the mobile (mirroring the reference esign
			// service); the actor identity authorizes the call.
			const raw = (await post(
				{
					...actor(input.identity),
					interaction_type_id: "287",
					document_id: "",
					agreement_id: AGREEMENT_ID,
					latlong: ONBOARDING_LATLONG,
					csp_id: input.mobile,
					user_id: input.mobile,
				},
				input.xRealIp,
			)) as {
				response_type_id?: number;
				status?: number | string;
				message?: string;
				document_id?: string;
				data?: { short_url?: string; document_id?: string; pipe?: number };
			};
			const code = Number(raw?.response_type_id ?? -1);
			// Upstream puts the id under `data` when it issues a URL, but at the TOP
			// LEVEL on the already-signed replies. Reading only `data` there yields
			// "", which then rides into 293 as an empty document_id. Eloka carries
			// the same fallback (esignService.ts) for exactly this reason.
			const documentId = String(
				raw?.data?.document_id || raw?.document_id || "",
			);
			const pipe = Number(raw?.data?.pipe ?? 0);
			// An absent `status` reads as 0: every observed reply carries it, and an
			// error one always carries it non-zero, so treating "missing" as an error
			// would only ever reject an otherwise-good payload.
			const ok = Number(raw?.status ?? 0) === 0;
			if (ok && AGREEMENT_ALREADY_SIGNED.has(code)) {
				return {
					ok: true,
					shortUrl: "",
					documentId,
					pipe,
					alreadySigned: true,
				};
			}
			// Success is `status: 0` plus a usable signing URL — nothing to sign
			// without one, and a stray `short_url` on an error reply must not pass.
			// The scheme check keeps a non-http(s) URL out of `window.open` / the
			// provider SDK on the client.
			const shortUrl = String(raw?.data?.short_url ?? "").trim();
			if (ok && /^https?:\/\//i.test(shortUrl)) {
				return {
					ok: true,
					shortUrl,
					documentId,
					pipe,
					alreadySigned: false,
				};
			}
			return {
				ok: false,
				message: raw?.message ?? "Couldn't start the agreement signing.",
				responseTypeId: code,
				details: errorDetails(raw),
			};
		},
		async submitSignAgreement(input) {
			const raw = await post(
				{
					...actor(input.identity),
					interaction_type_id: "293",
					document_id: input.documentId,
					agreement_id: AGREEMENT_ID,
					// The field upstream actually requires — omitting it answers
					// `invalid_params: {agreement_status: ...}`. It is the provider's
					// own outcome, relayed: the transaction framework's e-sign chain
					// maps the SDK result into it (`"output": {"agreement_status":
					// "agreement_status"}`) and Eloka's Android bridge compares it to
					// "success". This client is only ever called once the signing
					// provider reported success, so that is what it reports.
					agreement_status: "success",
					// Not upstream parameters (no definition exists for either), but
					// Eloka posts them and upstream ignores them. Kept for parity.
					esign_completed: "true",
					completion_timestamp: new Date().toISOString(),
					latlong: ONBOARDING_LATLONG,
				},
				input.xRealIp,
			);
			// Not `stepResult`: 293 has no single success id (1043 and 1069 both
			// observed), so classify on `status` like 287. Absent `status` fails
			// here — unlike 287 there is no payload to corroborate it, and passing
			// an unsigned agreement would advance the user past the step.
			const r = raw as {
				status?: number | string;
				response_type_id?: number;
				message?: string;
			};
			if (Number(r?.status ?? -1) === 0) return { ok: true };
			return {
				ok: false,
				message: r?.message ?? "The request could not be completed.",
				responseTypeId: Number(r?.response_type_id ?? -1),
				details: errorDetails(raw),
			};
		},
		async getWalletBalance(input) {
			const raw = (await post(
				{
					...actor(input.identity),
					interaction_type_id: "9",
					source: "EPS",
				},
				input.xRealIp,
			)) as { data?: { balance?: unknown } };
			// Classify by the presence of a numeric `balance`, not by a status id.
			// Eloka's own wallet read does exactly this (WalletContext.js: `"balance"
			// in data.data`) and no success id is documented for interaction 9 —
			// gating on `response_status_id === 0` would be a guess, and interaction
			// 151 already proves that field is not a uniform success flag upstream.
			// `balance` arrives as a string. Reject a blank one BEFORE Number(),
			// which coerces "" and " " into a very convincing 0 — Eloka's own
			// `+balance || 0` has exactly that bug. A wrong ₹0 is worse than an
			// error the console can retry.
			const rawBalance = raw?.data?.balance;
			if (typeof rawBalance !== "number" && typeof rawBalance !== "string") {
				return null;
			}
			if (typeof rawBalance === "string" && rawBalance.trim() === "")
				return null;
			const balance = Number(rawBalance);
			return Number.isFinite(balance) ? balance : null;
		},
		async getTransactionHistory(input) {
			const raw = await post(
				{
					// `filters` is spread FIRST so none of its keys can override the
					// system fields below (actor identity, interaction_type_id, paging).
					// The route already narrows them to a known allow-list, so this is
					// defence in depth — and it matches `submitBusiness` above, which
					// spreads its untrusted `details` first for the same reason.
					...input.filters,
					...actor(input.identity),
					interaction_type_id: "154",
					source: "EPS",
					isNetworkTransactionHistory: "0",
					start_index: String(input.startIndex),
					limit: String(input.limit),
					...(input.accountId ? { account_id: input.accountId } : {}),
				},
				input.xRealIp,
				// 154 lives on the older API version — see `historyUrl`.
				historyUrl,
			);
			return { rows: mapTransactionRows(raw) };
		},
	};
}

/** Coerces an upstream money/number field, which may arrive as a numeric string. */
function num(value: unknown): number {
	const n = Number(value ?? 0);
	return Number.isFinite(n) ? n : 0;
}

/** Coerces an upstream text field, dropping empties so the UI can skip them. */
function text(value: unknown): string | undefined {
	if (value === null || value === undefined) return undefined;
	const s = String(value).trim();
	return s === "" ? undefined : s;
}

/**
 * Maps an upstream interaction-154 response to typed rows.
 *
 * Deliberately transport-agnostic: it takes the parsed body, so it stays correct
 * whatever transport the call arrives over.
 *
 * The `data.transaction_list` path is CONFIRMED against a real response, kept
 * verbatim in `transactions.sample.ts` and asserted by its tests. Eloka reads
 * `data.data.transaction_list` only because its own fetcher adds an extra
 * `data` layer — that wrapper is Eloka's, not upstream's.
 * @param raw - The parsed upstream response body.
 * @returns Typed rows; an empty array when the payload carries no list.
 */
export function mapTransactionRows(raw: unknown): TransactionRow[] {
	const list = (raw as { data?: { transaction_list?: unknown } })?.data
		?.transaction_list;
	if (!Array.isArray(list)) return [];
	return list.map((entry) => {
		const r = (entry ?? {}) as Record<string, unknown>;
		return {
			tid: String(r.tid ?? ""),
			tx_typeid: num(r.tx_typeid),
			tx_name: String(r.tx_name ?? ""),
			amount_dr: num(r.amount_dr),
			amount_cr: num(r.amount_cr),
			fee: num(r.fee),
			commission_earned: num(r.commission_earned),
			bonus: num(r.bonus),
			tds: num(r.tds),
			gst: num(r.gst),
			insurance_amount: num(r.insurance_amount),
			eko_service_charge: num(r.eko_service_charge),
			eko_gst: num(r.eko_gst),
			r_bal: num(r.r_bal),
			status: String(r.status ?? ""),
			response_status_id: num(r.response_status_id),
			datetime: String(r.datetime ?? ""),
			customer_name: text(r.customer_name),
			customer_mobile: text(r.customer_mobile),
			account: text(r.account),
			bank: text(r.bank),
			operator: text(r.operator),
			rrn: text(r.rrn),
			trackingnumber: text(r.trackingnumber),
			recipient_name: text(r.recipient_name),
			recipient_mobile: text(r.recipient_mobile),
		};
	});
}

/**
 * The blocks of interaction 151's `data` that `/me` forwards to the browser,
 * beyond the `user_detail` and `account_detail` already mapped above.
 *
 * An ALLOWLIST, deliberately, rather than "every sibling key": whatever lands
 * here is served to the page, so a block upstream starts sending later must be
 * read and reviewed before it ships — not forwarded the moment it appears.
 * Nothing here may carry credentials, tokens or PINs.
 *
 * Both spellings of each name are listed because the singular/plural is
 * upstream's choice and differs between blocks; the extra entries cost nothing
 * and save a release if 151 answers with the other one.
 */
const PROFILE_DETAIL_BLOCKS = [
	"personal_detail",
	"personal_details",
	"shop_detail",
	"shop_details",
	"business_detail",
	"business_details",
	"business_address_detail",
	"business_address_details",
] as const;

/**
 * Copies the allowlisted profile blocks out of interaction 151's `data`.
 * @param data - The whole `data` object; `{}` for callers that have only the user detail.
 * @returns Only the blocks that are present AND objects — a scalar under one of
 * these names is upstream sending something other than a detail block, and is
 * dropped rather than handed to the UI to render.
 */
function pickDetailBlocks(
	data: Record<string, unknown>,
): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const key of PROFILE_DETAIL_BLOCKS) {
		const block = data[key];
		if (block && typeof block === "object" && !Array.isArray(block)) {
			out[key] = block;
		}
	}
	return out;
}

function mapProfile(
	d: Record<string, unknown>,
	accountDetail?: AccountDetail,
	data: Record<string, unknown> = {},
): EkoProfile {
	const roles = Array.isArray(d.role_list) ? d.role_list : [];
	return {
		accounts: mapAccounts(accountDetail),
		evalueAccountId: selectEvalueAccountId(accountDetail),
		detailBlocks: pickDetailBlocks(data),
		accountStateId: toStateId(d.account_state_id),
		userDetail: stripSensitive(d),
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
					role: Number(s?.role ?? -1),
					label: String(s?.label ?? ""),
				}))
			: [],
	};
}
