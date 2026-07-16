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
	},
};

/** Builds an EkoClient double; only the methods a test needs are provided. */
function ekoStub(over: Partial<EkoClient>): EkoClient {
	return {
		sendOtp: vi.fn(),
		verifyOtp: vi.fn(),
		getProfile: vi.fn(),
		createPartialAccount: vi.fn(),
		verifyPan: vi.fn(),
		submitBusiness: vi.fn(),
		getBooklet: vi.fn(),
		fetchPintwinKey: vi.fn(),
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
			identity: { initiatorId: "55501", userCode: "20810001", orgId: 1 },
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
	it("fetches a fresh key per PIN and submits both encoded okekeys", async () => {
		const setSecretPin = vi.fn().mockResolvedValue({ ok: true });
		const fetchPintwinKey = vi
			.fn()
			.mockResolvedValueOnce({ pintwinKey: "1974856302", keyId: 39 })
			.mockResolvedValueOnce({ pintwinKey: "0123456789", keyId: 41 });
		const svc = createSignupService({
			eko: ekoStub({
				setSecretPin,
				fetchPintwinKey,
				getBooklet: vi.fn().mockResolvedValue({
					bookletSerialNumber: "SN123",
					isPintwinUser: 1,
				}),
				getProfile: vi.fn().mockResolvedValue(onboardingProfile),
			}),
			cfg,
		});
		await svc.submitPin("9990000001", "1234", "1234");
		// Two independent keys, mirroring Eloka's two Pintwin mounts.
		expect(fetchPintwinKey).toHaveBeenCalledTimes(2);
		expect(setSecretPin).toHaveBeenCalledWith(
			expect.objectContaining({
				firstOkekey: "9748|39",
				secondOkekey: "1234|41",
				booklet: { bookletSerialNumber: "SN123", isPintwinUser: 1 },
			}),
		);
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
