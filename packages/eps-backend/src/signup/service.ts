import type { AuthProvider } from "../auth/provider";
import type { ConnectClient } from "../clients/connect";
import type {
	Attribution,
	BusinessDetails,
	EkoClient,
	EkoErrorDetails,
} from "../clients/eko";
import {
	agreementIdOf,
	identityOf,
	normalizeAgreementId,
} from "../clients/eko";
import type { Config } from "../config";
import type { KV } from "../store/kv";
import type { EkoProfile, ProfileResult } from "../types";
import { encodePin } from "./pintwin";

/** One step of the onboarding journey, as named by upstream. */
export interface SignupStep {
	role: number;
	label: string;
}

/**
 * The client-facing onboarding state. Always derived from a fresh upstream
 * profile fetch — never from client-supplied progress.
 */
export interface SignupState {
	mobile: string;
	/** `new` = no partial account yet; `done` = onboarding complete. */
	status: "new" | "in_progress" | "done";
	steps: SignupStep[];
	/** The step awaiting input, or null when there is none. */
	currentRole: number | null;
	/** Profile display name, when the upstream 151 record carries one. */
	name?: string;
	/** Profile email, when the upstream 151 record carries one. */
	email?: string;
	/**
	 * The verified PAN, when upstream has back-filled it (`user_detail.
	 * pancardnumber`). Present only once the PAN step has run, and only if
	 * upstream chooses to echo it — treat it as best-effort, never as the
	 * signal for "has this user done the PAN step" (`currentRole` is that).
	 *
	 * Forwarded so the Business step can say which PAN its prefilled name came
	 * from after a page reload, when the browser no longer holds it. Nothing
	 * else off `userDetail` is forwarded here: each field added is more PII on
	 * the wire to a half-onboarded session.
	 */
	pan?: string;
	/**
	 * The profile's Zoho CRM Lead id (`user_detail.crm_lead_id`), once upstream
	 * has created the Lead — it appears mid-signup, around the PAN step. Not
	 * PII: an opaque record id the partner's own CRM routes resolve anyway.
	 * Forwarded so the wizard knows when to refresh the Lead and record its
	 * marketing attribution (`docs/features/crm-lead.md`).
	 */
	crmLeadId?: string;
}

/** Shape upstream PANs must match before being forwarded to the client. */
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

/**
 * Outcome of a PIN-code lookup, as the route needs to see it.
 *
 * `ok` covers the "found nothing" case too, as `{null, null}`: an unrecognised
 * PIN code is an ordinary answer, and the client just leaves City and State for
 * the user to type. Only `malformed` — upstream answering OK and carrying no
 * payload — is a fault, and it stays separate so a broken lookup cannot hide as
 * a run of unknown codes.
 *
 * Returned rather than thrown: the empty answer is an expected state, and
 * exceptions are the wrong shape for a routine branch.
 */
export type PincodeOutcome =
	| { ok: true; city: string | null; state: string | null }
	| { ok: false; reason: "malformed"; message: string };

/** The e-sign URL details the client needs to open the signing provider. */
export interface AgreementUrl {
	/** Provider signing URL; empty when `alreadySigned`. */
	shortUrl: string;
	/** Document id echoed back on the submit step. */
	documentId: string;
	/** Provider id (0 DigiO, 1 Karza, 2 Signzy, 3 Leegality). */
	pipe: number;
	/** True when upstream reports the agreement is already signed — skip the popup. */
	alreadySigned: boolean;
}

/** Orchestrates user signup, validating inputs before any upstream call. */
export interface SignupService {
	getState(mobile: string, xRealIp?: string): Promise<SignupState>;
	createProfile(
		mobile: string,
		attribution: Attribution,
		xRealIp?: string,
	): Promise<SignupState>;
	submitPan(
		mobile: string,
		pan: string,
		xRealIp?: string,
	): Promise<SignupState>;
	submitBusiness(
		mobile: string,
		details: BusinessDetails,
		xRealIp?: string,
	): Promise<SignupState>;
	lookupPincode(
		mobile: string,
		pincode: string,
		xRealIp?: string,
	): Promise<PincodeOutcome>;
	/**
	 * Sets the user's secret PIN.
	 *
	 * Takes the session id as well as the mobile: the single-use substitution
	 * keys come from connect-api (interaction 10005), which authenticates off
	 * this session's own sealed upstream token.
	 */
	submitPin(
		mobile: string,
		pin1: string,
		pin2: string,
		sid?: string,
		xRealIp?: string,
	): Promise<SignupState>;
	/**
	 * Fetches the provider signing URL (interaction 287).
	 *
	 * Takes the session id because a profile without an agreement id falls back
	 * to the user's pending-agreement list (interaction 300, on connect-api).
	 */
	getAgreementUrl(
		mobile: string,
		sid?: string,
		xRealIp?: string,
	): Promise<AgreementUrl>;
	/** Submits the signed document (interaction 293); `sid` as for `getAgreementUrl`. */
	submitSignAgreement(
		mobile: string,
		documentId: string,
		sid?: string,
		xRealIp?: string,
	): Promise<SignupState>;
}

/** Re-exported so route handlers have one import site for the request shape — `http/` should not reach past `service/` into `clients/`. */
export type { Attribution, BusinessDetails } from "../clients/eko";
export { ATTRIBUTION_KEYS } from "../clients/eko";

/** A step that failed upstream, carrying the upstream's own message for the user. */
export class SignupStepError extends Error {
	readonly responseTypeId: number;
	/**
	 * Upstream's diagnostic sub-objects (`invalid_params`, …), forwarded to the
	 * client. Without them a field-validation failure reaches the user as a bare
	 * "Please provide the value of the field" naming no field.
	 */
	readonly details?: EkoErrorDetails;

	constructor(
		message: string,
		responseTypeId: number,
		details?: EkoErrorDetails,
	) {
		super(message);
		this.responseTypeId = responseTypeId;
		this.details = details;
		this.name = "SignupStepError";
	}
}

const PIN_LENGTH = 4;

/** `interaction_type_id` for "list my pending agreements" (connect-api). */
const AGREEMENT_PENDING_INTERACTION = 300;

/** How long a 287 document stays bound to its agreement id: covers a slow signing. */
const AGREEMENT_ID_TTL_SEC = 24 * 60 * 60;

/** Creates the signup orchestration service. */
export function createSignupService(deps: {
	eko: EkoClient;
	cfg: Config;
	/**
	 * Present only when `CONNECT_API_BASE_URL` is configured. The PIN step
	 * cannot run without it — interaction 10005 is served by connect-api, not by
	 * the SimpliBank upstream — so its absence is a deployment fault, not a
	 * degraded mode.
	 */
	connect?: ConnectClient;
	/** Supplies the sealed upstream token behind a session id. */
	auth?: AuthProvider;
	/** Binds a 287 document to its agreement id for 293. Optional: 293 re-resolves without it. */
	kv?: KV;
}): SignupService {
	const { eko, connect, auth, kv } = deps;

	/**
	 * Projects an upstream profile result into client state.
	 *
	 * `role_list` carries the PENDING roles, so the current step is the first
	 * entry of `onboarding_steps` that still appears there. Everything before it
	 * is complete.
	 */
	function project(mobile: string, r: ProfileResult): SignupState {
		if (r.kind === "not_found") {
			return { mobile, status: "new", steps: [], currentRole: null };
		}
		if (r.kind !== "onboarding" && r.kind !== "found") {
			throw new SignupStepError(
				"Couldn't load your profile right now. Please try again.",
				r.responseTypeId,
			);
		}
		const { profile } = r;
		const steps = profile.onboardingSteps;
		// Empty upstream strings collapse to undefined so the client sees a clean
		// "absent" rather than an empty-string prefill.
		const name = profile.name || undefined;
		const email = profile.email || undefined;
		const pan = panOf(profile);
		const crmLeadId =
			String(profile.userDetail.crm_lead_id ?? "").trim() || undefined;
		if (profile.onboarding === 0) {
			return {
				mobile,
				status: "done",
				steps,
				currentRole: null,
				name,
				email,
				pan,
				crmLeadId,
			};
		}
		const pending = new Set(profile.roleList.map((x) => Number(x)));
		const current = steps.find((s) => pending.has(s.role));
		return {
			mobile,
			status: "in_progress",
			steps,
			currentRole: current?.role ?? null,
			name,
			email,
			pan,
			crmLeadId,
		};
	}

	/**
	 * Reads the verified PAN off the profile's `user_detail` bag.
	 *
	 * Gated on the PAN shape rather than forwarded raw: `userDetail` is an
	 * untyped upstream record, so this is the boundary that stops a placeholder,
	 * a masked value, or an unrelated string from arriving at the client
	 * labelled as a PAN. Anything that doesn't match becomes `undefined`, which
	 * the Business step renders as "no PAN to show" — the same graceful path it
	 * takes when upstream omits the field entirely.
	 *
	 * @param profile - The mapped upstream profile.
	 * @returns The PAN in upper case, or undefined when absent or malformed.
	 */
	function panOf(profile: EkoProfile): string | undefined {
		const raw = profile.userDetail.pancardnumber;
		if (typeof raw !== "string") return undefined;
		const pan = raw.trim().toUpperCase();
		return PAN_PATTERN.test(pan) ? pan : undefined;
	}

	/** Fetches the profile, or throws if it is not usable for onboarding. */
	async function requireProfile(
		mobile: string,
		xRealIp?: string,
	): Promise<EkoProfile> {
		const r = await eko.getProfile({ mobile, xRealIp });
		if (r.kind !== "onboarding" && r.kind !== "found") {
			throw new SignupStepError(
				"Couldn't load your profile right now. Please try again.",
				r.responseTypeId,
			);
		}
		return r.profile;
	}

	/**
	 * Resolves this session's sealed upstream access token, for the connect-api
	 * calls a signup step needs.
	 *
	 * Refuses the step rather than degrading: the PIN cannot be set without a
	 * substitution key, and interaction 10005 lives on connect-api. The three
	 * causes are logged apart because they need different fixes — a missing
	 * `CONNECT_API_BASE_URL` is a deploy problem, a missing `sid` means this
	 * session was minted under the direct `eko` provider, and a missing stored
	 * session means the upstream credentials expired. The user sees one message
	 * for all three; the operator does not.
	 */
	async function requireUpstreamToken(
		sid: string | undefined,
		step: string,
	): Promise<string> {
		const fail = (why: string): never => {
			console.error("[signup] connect-api unavailable", { step, why });
			throw new SignupStepError(
				`Couldn't ${step} right now. Please try again.`,
				-1,
			);
		};
		if (!connect || !auth?.getUpstream)
			return fail("no connect-api configured");
		if (!sid) return fail("session has no sid");
		const upstream = await auth.getUpstream(sid);
		if (!upstream) return fail("no stored upstream session");
		return upstream.accessToken;
	}

	/**
	 * Resolves the user's agreement id for 287/293, or refuses the step.
	 *
	 * Order: the 151 profile's `user_detail.agreement_id`, else the user's own
	 * pending-agreement list (interaction 300, over connect-api). Some profiles
	 * reach the Agreement step without the id (prod, 2026-11-06), and 300 is
	 * where upstream lists what the user still has to sign.
	 *
	 * Never guesses: the id used to be hardcoded to the API (EPS) partner's '4',
	 * which either fails upstream as 1083 or signs the wrong agreement. So 300
	 * counts only when every entry carries a usable id and they name exactly ONE
	 * agreement — several pending, or a malformed entry, refuses rather than pick.
	 * `-1` marks a locally-raised failure, as elsewhere in this file.
	 */
	async function resolveAgreementId(
		mobile: string,
		profile: EkoProfile,
		step: string,
		sid: string | undefined,
		xRealIp: string | undefined,
	): Promise<string> {
		const fromProfile = agreementIdOf(profile);
		if (fromProfile) return fromProfile;

		const refuse = (why: Record<string, unknown>): never => {
			console.error("[signup] no agreement id", {
				step,
				mobile: mobile.slice(-4),
				...why,
			});
			throw new SignupStepError(
				`Couldn't ${step} right now. Please try again.`,
				-1,
			);
		};
		const token = await requireUpstreamToken(sid, step);
		let envelope: Record<string, unknown>;
		try {
			envelope =
				(await connect?.interact(
					token,
					{ interaction_type_id: AGREEMENT_PENDING_INTERACTION, locale: "en" },
					{ xRealIp },
				)) ?? {};
		} catch (err) {
			return refuse({ source: "300", err: String(err) });
		}
		const list = (envelope.data as { agreementList?: unknown } | undefined)
			?.agreementList;
		const raw = Array.isArray(list)
			? list.map((entry) =>
					normalizeAgreementId(
						(entry as { agreement_id?: unknown } | null)?.agreement_id,
					),
				)
			: [];
		const ids = [...new Set(raw)];
		if (
			Number(envelope.status ?? -1) !== 0 ||
			ids.length !== 1 ||
			ids[0] === null
		) {
			return refuse({
				source: "300",
				status: envelope.status ?? null,
				message: envelope.message ?? null,
				ids,
			});
		}
		return ids[0];
	}

	/** KV key binding a 287 document to the agreement id it was created with. */
	const agreementKey = (mobile: string, documentId: string) =>
		`signup:agreement:${mobile}:${documentId}`;

	/** Re-reads state from upstream after a step, so progress is never inferred. */
	async function refresh(
		mobile: string,
		xRealIp?: string,
	): Promise<SignupState> {
		return project(mobile, await eko.getProfile({ mobile, xRealIp }));
	}

	return {
		async getState(mobile, xRealIp) {
			return refresh(mobile, xRealIp);
		},

		async createProfile(mobile, attribution, xRealIp) {
			const result = await eko.createPartialAccount({
				mobile,
				attribution,
				xRealIp,
			});
			if (!result.ok) {
				throw new SignupStepError(
					result.message,
					result.responseTypeId,
					result.details,
				);
			}
			return refresh(mobile, xRealIp);
		},

		async submitPan(mobile, pan, xRealIp) {
			const profile = await requireProfile(mobile, xRealIp);
			const result = await eko.verifyPan({
				pan,
				identity: identityOf(profile),
				xRealIp,
			});
			if (!result.ok) {
				throw new SignupStepError(
					result.message,
					result.responseTypeId,
					result.details,
				);
			}
			return refresh(mobile, xRealIp);
		},

		async submitBusiness(mobile, details, xRealIp) {
			const profile = await requireProfile(mobile, xRealIp);
			const result = await eko.submitBusiness({
				details,
				identity: identityOf(profile),
				xRealIp,
			});
			if (!result.ok) {
				throw new SignupStepError(
					result.message,
					result.responseTypeId,
					result.details,
				);
			}
			return refresh(mobile, xRealIp);
		},

		async lookupPincode(mobile, pincode, xRealIp) {
			const profile = await requireProfile(mobile, xRealIp);
			const result = await eko.lookupPincode({
				pincode,
				identity: identityOf(profile),
				xRealIp,
			});
			// Deliberately no `refresh()`: this reads a reference table and changes
			// nothing upstream, so re-projecting onboarding state would be a second
			// 151 call for no reason.
			if (result.ok)
				return { ok: true, city: result.city, state: result.state };
			// An unrecognised code is a normal answer; only a malformed reply is a
			// fault worth shouting about.
			if (result.kind === "miss") return { ok: true, city: null, state: null };
			return { ok: false, reason: "malformed", message: result.message };
		},

		async submitPin(mobile, pin1, pin2, sid, xRealIp) {
			// Validate before touching upstream: a mismatch must not burn a
			// single-use pintwin key.
			if (pin1 !== pin2) {
				throw new SignupStepError("The PINs do not match.", -1);
			}
			if (!new RegExp(`^[0-9]{${PIN_LENGTH}}$`).test(pin1)) {
				throw new SignupStepError(`The PIN must be ${PIN_LENGTH} digits.`, -1);
			}
			const profile = await requireProfile(mobile, xRealIp);
			const identity = identityOf(profile);

			const booklet = await eko.getBooklet({ identity, xRealIp });
			if (!booklet) {
				throw new SignupStepError(
					"Couldn't start PIN setup right now. Please try again.",
					-1,
				);
			}
			// The substitution keys come from connect-api (interaction 10005), not
			// from the SimpliBank upstream the surrounding steps use: the 10000+
			// range is served only there. Resolved AFTER the PIN-shape checks
			// above, so a typo still cannot cost a round-trip.
			const token = await requireUpstreamToken(sid, "secure your PIN");
			// One key per PIN: upstream invalidates a key after each use, and Eloka
			// mounts two independent Pintwins for the same reason. Each okekey
			// carries its own `|key_id` so the server can invert the right table.
			const first = await connect?.fetchPintwinKey(token, mobile, { xRealIp });
			const second = await connect?.fetchPintwinKey(token, mobile, { xRealIp });
			if (!first || !second) {
				throw new SignupStepError(
					"Couldn't secure your PIN right now. Please try again.",
					-1,
				);
			}
			const result = await eko.setSecretPin({
				firstOkekey: encodePin(pin1, first.pintwinKey, first.keyId),
				secondOkekey: encodePin(pin2, second.pintwinKey, second.keyId),
				booklet,
				identity,
				xRealIp,
			});
			if (!result.ok) {
				throw new SignupStepError(
					result.message,
					result.responseTypeId,
					result.details,
				);
			}
			return refresh(mobile, xRealIp);
		},

		async getAgreementUrl(mobile, sid, xRealIp) {
			const profile = await requireProfile(mobile, xRealIp);
			const agreementId = await resolveAgreementId(
				mobile,
				profile,
				"start the agreement signing",
				sid,
				xRealIp,
			);
			const result = await eko.getAgreementUrl({
				mobile,
				identity: identityOf(profile),
				agreementId,
				xRealIp,
			});
			if (!result.ok) {
				throw new SignupStepError(
					result.message,
					result.responseTypeId,
					result.details,
				);
			}
			// 293 runs after signing, when 300 may no longer list the agreement —
			// so remember exactly which id this document was created with.
			// Best-effort: 293 still falls back to resolving it afresh.
			try {
				await kv?.set(
					agreementKey(mobile, result.documentId),
					agreementId,
					AGREEMENT_ID_TTL_SEC,
				);
			} catch (err) {
				console.error("[signup] agreement id bind failed", {
					mobile: mobile.slice(-4),
					err: String(err),
				});
			}
			return {
				shortUrl: result.shortUrl,
				documentId: result.documentId,
				pipe: result.pipe,
				alreadySigned: result.alreadySigned,
			};
		},

		async submitSignAgreement(mobile, documentId, sid, xRealIp) {
			const profile = await requireProfile(mobile, xRealIp);
			// The id 287 bound to this document wins; resolving afresh is the
			// fallback (KV lost, expired, or not configured).
			let bound: string | null = null;
			try {
				bound = (await kv?.get(agreementKey(mobile, documentId))) ?? null;
			} catch {
				// best-effort: fall through to resolving it
			}
			const agreementId =
				bound ??
				(await resolveAgreementId(
					mobile,
					profile,
					"complete the agreement signing",
					sid,
					xRealIp,
				));
			const result = await eko.submitSignAgreement({
				documentId,
				identity: identityOf(profile),
				agreementId,
				xRealIp,
			});
			if (!result.ok) {
				throw new SignupStepError(
					result.message,
					result.responseTypeId,
					result.details,
				);
			}
			return refresh(mobile, xRealIp);
		},
	};
}
