import type { BusinessDetails, EkoClient, EkoIdentity } from "../clients/eko";
import type { Config } from "../config";
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
}

/** Orchestrates user signup, validating inputs before any upstream call. */
export interface SignupService {
	getState(mobile: string, xRealIp?: string): Promise<SignupState>;
	createProfile(mobile: string, xRealIp?: string): Promise<SignupState>;
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
	submitPin(
		mobile: string,
		pin1: string,
		pin2: string,
		xRealIp?: string,
	): Promise<SignupState>;
}

/** Re-exported so route handlers have one import site for the request shape — `http/` should not reach past `service/` into `clients/`. */
export type { BusinessDetails } from "../clients/eko";

/** A step that failed upstream, carrying the upstream's own message for the user. */
export class SignupStepError extends Error {
	readonly responseTypeId: number;

	constructor(message: string, responseTypeId: number) {
		super(message);
		this.responseTypeId = responseTypeId;
		this.name = "SignupStepError";
	}
}

const PIN_LENGTH = 4;

/** Creates the signup orchestration service. */
export function createSignupService(deps: {
	eko: EkoClient;
	cfg: Config;
}): SignupService {
	const { eko } = deps;

	/** The user's own identity, valid once the partial account exists. */
	function identityOf(profile: EkoProfile): EkoIdentity {
		return {
			initiatorId: profile.ekoUserId,
			userCode: String(profile.code),
			orgId: profile.orgId,
		};
	}

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
		if (profile.onboarding === 0) {
			return { mobile, status: "done", steps, currentRole: null };
		}
		const pending = new Set(profile.roleList.map((x) => Number(x)));
		const current = steps.find((s) => pending.has(s.role));
		return {
			mobile,
			status: "in_progress",
			steps,
			currentRole: current?.role ?? null,
		};
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

		async createProfile(mobile, xRealIp) {
			const result = await eko.createPartialAccount({ mobile, xRealIp });
			if (!result.ok) {
				throw new SignupStepError(result.message, result.responseTypeId);
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
				throw new SignupStepError(result.message, result.responseTypeId);
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
				throw new SignupStepError(result.message, result.responseTypeId);
			}
			return refresh(mobile, xRealIp);
		},

		async submitPin(mobile, pin1, pin2, xRealIp) {
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
			// One key per PIN: upstream invalidates a key after each use, and Eloka
			// mounts two independent Pintwins for the same reason. Each okekey
			// carries its own `|key_id` so the server can invert the right table.
			const first = await eko.fetchPintwinKey({ mobile, identity, xRealIp });
			const second = await eko.fetchPintwinKey({ mobile, identity, xRealIp });
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
				throw new SignupStepError(result.message, result.responseTypeId);
			}
			return refresh(mobile, xRealIp);
		},
	};
}
