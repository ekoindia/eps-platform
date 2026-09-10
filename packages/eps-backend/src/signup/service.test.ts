import { describe, expect, it, vi } from "vitest";
import type { EkoClient } from "../clients/eko";
import type { Config } from "../config";
import { createSignupService, SignupStepError } from "./service";

const cfg = {
	eko: { initiatorId: "9990000000", userCode: "20810200", defaultOrgId: 1 },
} as unknown as Config;

/** A profile mid-onboarding, pending both steps. */
const onboardingProfile = {
	kind: "onboarding" as const,
	responseTypeId: 369,
	profile: {
		name: "",
		email: "",
		mobile: "9990000001",
		code: "20810001",
		userType: "23",
		ekoUserId: "55501",
		roleList: ["13000", "12600"],
		orgId: 1,
		onboarding: 1,
		zohoId: "",
		onboardingSteps: [
			{ role: 13000, label: "PAN Details" },
			{ role: 12600, label: "Set Secret PIN" },
		],
		// The user's own e-sign agreement id (interactions 287/293). NOT "4":
		// that was the hardcoded API (EPS) partner id these tests must not pass on.
		userDetail: { agreement_id: "7" },
	},
};

/** The same onboarding profile, with extra `user_detail` keys merged in. */
function withUserDetail(extra: Record<string, unknown>) {
	return {
		...onboardingProfile,
		profile: {
			...onboardingProfile.profile,
			userDetail: { ...onboardingProfile.profile.userDetail, ...extra },
		},
	};
}

/**
 * Builds the connect-api double the PIN step needs, plus an auth provider that
 * yields a sealed upstream token. Interaction 10005 lives on connect-api, so a
 * `submitPin` test without these cannot get past the key fetch.
 */
function pintwinDeps(fetchPintwinKey = vi.fn()) {
	return {
		fetchPintwinKey,
		connect: { fetchPintwinKey } as never,
		auth: {
			name: "connect" as const,
			getUpstream: vi.fn().mockResolvedValue({ accessToken: "tok-1" }),
		} as never,
	};
}

/** Builds an EkoClient double; only the methods a test needs are provided. */
function ekoStub(over: Partial<EkoClient>): EkoClient {
	return {
		sendOtp: vi.fn(),
		verifyOtp: vi.fn(),
		getProfile: vi.fn(),
		createPartialAccount: vi.fn(),
		verifyPan: vi.fn(),
		submitBusiness: vi.fn(),
		lookupPincode: vi.fn(),
		getBooklet: vi.fn(),
		setSecretPin: vi.fn(),
		...over,
	} as unknown as EkoClient;
}

describe("getState", () => {
	it("reports status new when the profile does not exist", async () => {
		const eko = ekoStub({
			getProfile: vi
				.fn()
				.mockResolvedValue({ kind: "not_found", responseTypeId: 319 }),
		});
		const svc = createSignupService({ eko, cfg });
		expect(await svc.getState("9990000001")).toEqual({
			mobile: "9990000001",
			status: "new",
			steps: [],
			currentRole: null,
		});
	});

	it("projects steps and the current role while onboarding", async () => {
		const eko = ekoStub({
			getProfile: vi.fn().mockResolvedValue(onboardingProfile),
		});
		const svc = createSignupService({ eko, cfg });
		expect(await svc.getState("9990000001")).toEqual({
			mobile: "9990000001",
			status: "in_progress",
			steps: [
				{ role: 13000, label: "PAN Details" },
				{ role: 12600, label: "Set Secret PIN" },
			],
			currentRole: 13000,
		});
	});

	it("picks the first pending role from role_list, not the first step", async () => {
		// PAN is done; role_list carries only the PIN role.
		const eko = ekoStub({
			getProfile: vi.fn().mockResolvedValue({
				...onboardingProfile,
				profile: { ...onboardingProfile.profile, roleList: ["12600"] },
			}),
		});
		const svc = createSignupService({ eko, cfg });
		const state = await svc.getState("9990000001");
		expect(state.currentRole).toBe(12600);
		expect(state.status).toBe("in_progress");
	});

	it("reports status done when onboarding completes", async () => {
		const eko = ekoStub({
			getProfile: vi.fn().mockResolvedValue({
				kind: "found",
				responseTypeId: 369,
				profile: { ...onboardingProfile.profile, onboarding: 0, roleList: [] },
			}),
		});
		const svc = createSignupService({ eko, cfg });
		const state = await svc.getState("9990000001");
		expect(state.status).toBe("done");
		expect(state.currentRole).toBeNull();
	});

	it("reports in_progress with a null currentRole when role_list is empty", async () => {
		// This is the fallback consumers must handle: onboarding in progress but
		// no current role yet (e.g., awaiting upstream step assignment).
		const eko = ekoStub({
			getProfile: vi.fn().mockResolvedValue({
				...onboardingProfile,
				profile: { ...onboardingProfile.profile, roleList: [] },
			}),
		});
		const svc = createSignupService({ eko, cfg });
		const state = await svc.getState("9990000001");
		expect(state.status).toBe("in_progress");
		expect(state.currentRole).toBeNull();
	});
});

describe("project surfaces profile name/email", () => {
	it("carries a non-empty name/email onto in-progress state", async () => {
		const eko = ekoStub({
			getProfile: vi.fn().mockResolvedValue({
				...onboardingProfile,
				profile: {
					...onboardingProfile.profile,
					name: "Asha Rao",
					email: "asha@acme.in",
				},
			}),
		});
		const svc = createSignupService({ eko, cfg });
		const state = await svc.getState("9990000001");
		expect(state.name).toBe("Asha Rao");
		expect(state.email).toBe("asha@acme.in");
	});

	it("omits name/email when the upstream strings are empty", async () => {
		const eko = ekoStub({
			getProfile: vi.fn().mockResolvedValue(onboardingProfile),
		});
		const svc = createSignupService({ eko, cfg });
		const state = await svc.getState("9990000001");
		expect(state.name).toBeUndefined();
		expect(state.email).toBeUndefined();
	});

	it("forwards the PAN once upstream back-fills pancardnumber", async () => {
		const eko = ekoStub({
			getProfile: vi.fn().mockResolvedValue(
				withUserDetail({
					pancardnumber: "aaatu1234e",
				}),
			),
		});
		const svc = createSignupService({ eko, cfg });
		// Upper-cased on the way out so the client can render it verbatim.
		expect((await svc.getState("9990000001")).pan).toBe("AAATU1234E");
	});

	it("omits the PAN when upstream has not back-filled it", async () => {
		const eko = ekoStub({
			getProfile: vi.fn().mockResolvedValue(onboardingProfile),
		});
		const svc = createSignupService({ eko, cfg });
		expect((await svc.getState("9990000001")).pan).toBeUndefined();
	});

	it.each([
		["a masked value", "AAATU****E"],
		["a placeholder", "NA"],
		["an empty string", "   "],
		["a non-string", 12345],
	])("omits the PAN for %s", async (_label, pancardnumber) => {
		const eko = ekoStub({
			getProfile: vi.fn().mockResolvedValue(withUserDetail({ pancardnumber })),
		});
		const svc = createSignupService({ eko, cfg });
		expect((await svc.getState("9990000001")).pan).toBeUndefined();
	});
});

describe("lookupPincode", () => {
	it("runs the lookup against the eko upstream with the caller's identity", async () => {
		const lookupPincode = vi
			.fn()
			.mockResolvedValue({ ok: true, city: "Bangalore", state: "Karnataka" });
		const eko = ekoStub({
			getProfile: vi.fn().mockResolvedValue(onboardingProfile),
			lookupPincode,
		});
		const svc = createSignupService({ eko, cfg });
		expect(await svc.lookupPincode("9990000001", "560001")).toEqual({
			ok: true,
			city: "Bangalore",
			state: "Karnataka",
		});
		expect(lookupPincode).toHaveBeenCalledWith(
			expect.objectContaining({
				pincode: "560001",
				identity: expect.objectContaining({ initiatorId: "9990000001" }),
			}),
		);
	});

	it("reports an unrecognised code as a successful empty answer", async () => {
		const eko = ekoStub({
			getProfile: vi.fn().mockResolvedValue(onboardingProfile),
			lookupPincode: vi.fn().mockResolvedValue({
				ok: false,
				kind: "miss",
				message: "Invalid pincode",
				responseTypeId: 1502,
			}),
		});
		const svc = createSignupService({ eko, cfg });
		expect(await svc.lookupPincode("9990000001", "999999")).toEqual({
			ok: true,
			city: null,
			state: null,
		});
	});

	it("reports a malformed reply as a fault, so a dead lookup cannot hide", async () => {
		const eko = ekoStub({
			getProfile: vi.fn().mockResolvedValue(onboardingProfile),
			lookupPincode: vi.fn().mockResolvedValue({
				ok: false,
				kind: "malformed",
				message: "no dependent_params",
				responseTypeId: 1043,
			}),
		});
		const svc = createSignupService({ eko, cfg });
		expect(await svc.lookupPincode("9990000001", "560001")).toMatchObject({
			ok: false,
			reason: "malformed",
		});
	});

	it("does not re-read the profile after the lookup", async () => {
		const getProfile = vi.fn().mockResolvedValue(onboardingProfile);
		const eko = ekoStub({
			getProfile,
			lookupPincode: vi
				.fn()
				.mockResolvedValue({ ok: true, city: "Pune", state: null }),
		});
		const svc = createSignupService({ eko, cfg });
		await svc.lookupPincode("9990000001", "411001");
		// One call for the identity, none for a refresh — nothing changed upstream.
		expect(getProfile).toHaveBeenCalledTimes(1);
	});
});

describe("createProfile", () => {
	it("creates the partial account then returns refreshed state", async () => {
		const createPartialAccount = vi.fn().mockResolvedValue({ ok: true });
		// createProfile makes exactly one getProfile call (the post-create
		// refresh), so a single resolved value is what's actually consumed.
		const getProfile = vi.fn().mockResolvedValue(onboardingProfile);
		const svc = createSignupService({
			eko: ekoStub({ createPartialAccount, getProfile }),
			cfg,
		});
		const state = await svc.createProfile("9990000001");
		expect(createPartialAccount).toHaveBeenCalledWith({
			mobile: "9990000001",
			xRealIp: undefined,
		});
		expect(state.status).toBe("in_progress");
		expect(state.currentRole).toBe(13000);
	});

	it("throws SignupStepError carrying the upstream message on failure", async () => {
		const svc = createSignupService({
			eko: ekoStub({
				createPartialAccount: vi.fn().mockResolvedValue({
					ok: false,
					message: "Already exists",
					responseTypeId: 1500,
				}),
				getProfile: vi
					.fn()
					.mockResolvedValue({ kind: "not_found", responseTypeId: 319 }),
			}),
			cfg,
		});
		await expect(svc.createProfile("9990000001")).rejects.toThrow(
			"Already exists",
		);
	});
});

describe("submitPan", () => {
	it("acts as the user's own initiator using the fetched profile", async () => {
		const verifyPan = vi.fn().mockResolvedValue({ ok: true });
		const svc = createSignupService({
			eko: ekoStub({
				verifyPan,
				getProfile: vi.fn().mockResolvedValue(onboardingProfile),
			}),
			cfg,
		});
		await svc.submitPan("9990000001", "ABCDE1234F");
		expect(verifyPan).toHaveBeenCalledWith({
			pan: "ABCDE1234F",
			identity: { initiatorId: "9990000001", userCode: "20810001", orgId: 1 },
			xRealIp: undefined,
		});
	});
});

describe("submitBusiness", () => {
	const details = {
		name: "Acme Retail",
		company_type: "4",
		authorized_signatory_name: "Asha Rao",
		email: "asha@acme.in",
		current_address_line1: "12 MG Road, Indiranagar",
		current_address_line2: "",
		current_address_district: "Bengaluru",
		current_address_state: "Karnataka",
		current_address_pincode: "560038",
	};

	it("submits with the user's own identity and returns refreshed state", async () => {
		const submitBusiness = vi.fn().mockResolvedValue({ ok: true });
		const svc = createSignupService({
			eko: ekoStub({
				submitBusiness,
				getProfile: vi.fn().mockResolvedValue(onboardingProfile),
			}),
			cfg,
		});
		const state = await svc.submitBusiness("9990000001", details);
		expect(submitBusiness).toHaveBeenCalledWith(
			expect.objectContaining({
				details,
				identity: expect.objectContaining({ orgId: expect.any(Number) }),
			}),
		);
		expect(state.status).toBe("in_progress");
	});

	it("throws SignupStepError carrying the upstream message", async () => {
		const svc = createSignupService({
			eko: ekoStub({
				submitBusiness: vi.fn().mockResolvedValue({
					ok: false,
					message: "Invalid pincode",
					responseTypeId: 1502,
				}),
				getProfile: vi.fn().mockResolvedValue(onboardingProfile),
			}),
			cfg,
		});
		await expect(svc.submitBusiness("9990000001", details)).rejects.toThrow(
			"Invalid pincode",
		);
	});
});

describe("submitPin", () => {
	it("fetches a fresh key per PIN from connect-api and submits both encoded okekeys", async () => {
		const setSecretPin = vi.fn().mockResolvedValue({ ok: true });
		const { fetchPintwinKey, connect, auth } = pintwinDeps(
			vi
				.fn()
				.mockResolvedValueOnce({ pintwinKey: "1974856302", keyId: 39 })
				.mockResolvedValueOnce({ pintwinKey: "0123456789", keyId: 41 }),
		);
		const svc = createSignupService({
			eko: ekoStub({
				setSecretPin,
				getBooklet: vi.fn().mockResolvedValue({
					bookletSerialNumber: "SN123",
					isPintwinUser: 1,
				}),
				getProfile: vi.fn().mockResolvedValue(onboardingProfile),
			}),
			cfg,
			connect,
			auth,
		});
		await svc.submitPin("9990000001", "1234", "1234", "sid-1");
		// Two independent keys, mirroring Eloka's two Pintwin mounts.
		expect(fetchPintwinKey).toHaveBeenCalledTimes(2);
		// Authenticated by the session's sealed upstream token, not an
		// initiator/user_code pair — 10005 is a connect-api interaction.
		expect(fetchPintwinKey).toHaveBeenCalledWith("tok-1", "9990000001", {
			xRealIp: undefined,
		});
		expect(setSecretPin).toHaveBeenCalledWith(
			expect.objectContaining({
				firstOkekey: "9748|39",
				secondOkekey: "1234|41",
				booklet: { bookletSerialNumber: "SN123", isPintwinUser: 1 },
			}),
		);
	});

	it.each([
		[
			"this deployment has no connect-api",
			() => ({ connect: undefined, auth: undefined }),
		],
		[
			"the session has no sid",
			() => ({ ...pintwinDeps(vi.fn()), sid: undefined }),
		],
		[
			"the sealed upstream session is gone",
			() => ({
				connect: { fetchPintwinKey: vi.fn() } as never,
				auth: {
					name: "connect" as const,
					getUpstream: vi.fn().mockResolvedValue(null),
				} as never,
			}),
		],
	])("refuses the step when %s", async (_label, build) => {
		// The PIN cannot be set without a substitution key, so this fails the
		// step outright rather than degrading — unlike the PIN-code lookup.
		const over = build() as { connect?: never; auth?: never; sid?: string };
		const setSecretPin = vi.fn();
		const svc = createSignupService({
			eko: ekoStub({
				setSecretPin,
				getBooklet: vi.fn().mockResolvedValue({
					bookletSerialNumber: "SN123",
					isPintwinUser: 1,
				}),
				getProfile: vi.fn().mockResolvedValue(onboardingProfile),
			}),
			cfg,
			connect: over.connect,
			auth: over.auth,
		});
		await expect(
			svc.submitPin("9990000001", "1234", "1234", "sid" in over ? over.sid : "sid-1"),
		).rejects.toThrow(/secure your PIN/i);
		expect(setSecretPin).not.toHaveBeenCalled();
	});

	it("rejects mismatched pins before any upstream call", async () => {
		const getBooklet = vi.fn();
		const getProfile = vi.fn().mockResolvedValue(onboardingProfile);
		const svc = createSignupService({
			eko: ekoStub({ getBooklet, getProfile }),
			cfg,
		});
		await expect(svc.submitPin("9990000001", "1234", "5678")).rejects.toThrow(
			/do not match/i,
		);
		expect(getBooklet).not.toHaveBeenCalled();
		expect(getProfile).not.toHaveBeenCalled();
	});

	it("rejects a non-4-digit pin before any upstream call", async () => {
		const getBooklet = vi.fn();
		const getProfile = vi.fn().mockResolvedValue(onboardingProfile);
		const svc = createSignupService({
			eko: ekoStub({ getBooklet, getProfile }),
			cfg,
		});
		await expect(svc.submitPin("9990000001", "12", "12")).rejects.toThrow(
			/4 digits/,
		);
		expect(getBooklet).not.toHaveBeenCalled();
		expect(getProfile).not.toHaveBeenCalled();
	});

	it("throws when the booklet lookup fails", async () => {
		const svc = createSignupService({
			eko: ekoStub({
				getBooklet: vi.fn().mockResolvedValue(null),
				getProfile: vi.fn().mockResolvedValue(onboardingProfile),
			}),
			cfg,
		});
		await expect(svc.submitPin("9990000001", "1234", "1234")).rejects.toThrow(
			SignupStepError,
		);
	});
});

describe("getAgreementUrl", () => {
	const identity = {
		initiatorId: "9990000001",
		userCode: "20810001",
		orgId: 1,
	};

	it("fetches the URL with the user's own identity", async () => {
		const getAgreementUrl = vi.fn().mockResolvedValue({
			ok: true,
			shortUrl: "https://sign/x",
			documentId: "DOC9",
			pipe: 3,
			alreadySigned: false,
		});
		const svc = createSignupService({
			eko: ekoStub({
				getAgreementUrl,
				getProfile: vi.fn().mockResolvedValue(onboardingProfile),
			}),
			cfg,
		});
		const r = await svc.getAgreementUrl("9990000001");
		expect(getAgreementUrl).toHaveBeenCalledWith({
			mobile: "9990000001",
			identity,
			agreementId: "7",
			xRealIp: undefined,
		});
		expect(r).toEqual({
			shortUrl: "https://sign/x",
			documentId: "DOC9",
			pipe: 3,
			alreadySigned: false,
		});
	});

	it("throws SignupStepError when the URL fetch fails", async () => {
		const svc = createSignupService({
			eko: ekoStub({
				getAgreementUrl: vi.fn().mockResolvedValue({
					ok: false,
					message: "no url",
					responseTypeId: 1500,
				}),
				getProfile: vi.fn().mockResolvedValue(onboardingProfile),
			}),
			cfg,
		});
		await expect(svc.getAgreementUrl("9990000001")).rejects.toThrow("no url");
	});

	// REGRESSION: the id was hardcoded to the API (EPS) partner's "4". With no
	// id on the profile there is nothing safe to send, so the step must refuse
	// BEFORE touching upstream rather than fall back to a guess.
	it("refuses without calling upstream when the profile carries no agreement id", async () => {
		const getAgreementUrl = vi.fn();
		const svc = createSignupService({
			eko: ekoStub({
				getAgreementUrl,
				getProfile: vi.fn().mockResolvedValue({
					...onboardingProfile,
					profile: { ...onboardingProfile.profile, userDetail: {} },
				}),
			}),
			cfg,
		});
		await expect(svc.getAgreementUrl("9990000001")).rejects.toThrow(
			SignupStepError,
		);
		expect(getAgreementUrl).not.toHaveBeenCalled();
	});
});

describe("submitSignAgreement", () => {
	const identity = {
		initiatorId: "9990000001",
		userCode: "20810001",
		orgId: 1,
	};

	it("submits the document id with the user's identity and returns refreshed state", async () => {
		const submitSignAgreement = vi.fn().mockResolvedValue({ ok: true });
		const svc = createSignupService({
			eko: ekoStub({
				submitSignAgreement,
				getProfile: vi.fn().mockResolvedValue(onboardingProfile),
			}),
			cfg,
		});
		const state = await svc.submitSignAgreement("9990000001", "DOC9");
		expect(submitSignAgreement).toHaveBeenCalledWith({
			documentId: "DOC9",
			identity,
			agreementId: "7",
			xRealIp: undefined,
		});
		expect(state.status).toBe("in_progress");
	});

	it("throws SignupStepError carrying the upstream message", async () => {
		const svc = createSignupService({
			eko: ekoStub({
				submitSignAgreement: vi.fn().mockResolvedValue({
					ok: false,
					message: "not signed",
					responseTypeId: 1500,
				}),
				getProfile: vi.fn().mockResolvedValue(onboardingProfile),
			}),
			cfg,
		});
		await expect(svc.submitSignAgreement("9990000001", "DOC9")).rejects.toThrow(
			"not signed",
		);
	});

	// Same refusal as 287: submitting a guessed id would report the wrong
	// agreement as signed.
	it("refuses without calling upstream when the profile carries no agreement id", async () => {
		const submitSignAgreement = vi.fn();
		const svc = createSignupService({
			eko: ekoStub({
				submitSignAgreement,
				getProfile: vi.fn().mockResolvedValue({
					...onboardingProfile,
					profile: { ...onboardingProfile.profile, userDetail: {} },
				}),
			}),
			cfg,
		});
		await expect(svc.submitSignAgreement("9990000001", "DOC9")).rejects.toThrow(
			SignupStepError,
		);
		expect(submitSignAgreement).not.toHaveBeenCalled();
	});
});
