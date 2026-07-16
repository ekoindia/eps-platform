import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Sessions } from "../auth/session";
import type { EkoClient } from "../clients/eko";
import type { ZohoClient } from "../clients/zoho";
import type { Config } from "../config";
import type { SignupService, SignupState } from "../signup/service";
import { SignupStepError } from "../signup/service";
import { AppError, errorBody } from "./errors";
import type { AppEnv } from "./requestId";
import { mountSignup } from "./signup";

const inProgress: SignupState = {
	mobile: "9990000001",
	status: "in_progress",
	steps: [
		{ role: 13000, label: "PAN Details" },
		{ role: 12600, label: "Set Secret PIN" },
	],
	currentRole: 13000,
};

const foundProfile = {
	name: "Jane",
	email: "jane@example.com",
	mobile: "9990000001",
	code: 1,
	userType: "23",
	ekoUserId: "eko-1",
	roleList: [],
	orgId: 42,
	onboarding: 0,
	zohoId: "zoho-1",
	onboardingSteps: [],
};

const cfgStub = { eko: { defaultOrgId: 1 } } as unknown as Config;

/** Builds an app with a session double that returns `role` for any cookie. */
function harness(
	role: string | null,
	signup: Partial<SignupService>,
	overrides: {
		eko?: Partial<EkoClient>;
		zoho?: Partial<ZohoClient>;
		cfg?: Config;
		sessions?: Partial<Sessions>;
	} = {},
) {
	const app = new Hono<AppEnv>();
	// Mirrors app.ts's onError: AppError maps to its own status/code/message;
	// anything else is an unhandled 500. errorBody takes (code, message), not
	// the error itself — the status always travels as c.json's 2nd argument.
	app.onError((err, c) => {
		if (err instanceof AppError) {
			return c.json(errorBody(err.code, err.message), err.status as never);
		}
		return c.json(errorBody("UPSTREAM_ERROR", "Something went wrong"), 500);
	});
	const sessions = {
		verifyAccess: vi
			.fn()
			.mockResolvedValue(role ? { sub: "9990000001", role, orgId: 1 } : null),
		mintAccess: vi.fn().mockResolvedValue("access-token"),
		issueRefresh: vi.fn().mockResolvedValue("refresh-token"),
		accessCookie: vi.fn().mockReturnValue("eps_at=access-token; HttpOnly"),
		refreshCookie: vi.fn().mockReturnValue("eps_rt=refresh-token; HttpOnly"),
		...overrides.sessions,
	} as unknown as Sessions;
	const eko = {
		getProfile: vi.fn().mockResolvedValue({
			kind: "found",
			responseTypeId: 1,
			profile: foundProfile,
		}),
		...overrides.eko,
	} as unknown as EkoClient;
	const zoho = {
		findLead: vi.fn().mockResolvedValue(false),
		...overrides.zoho,
	} as unknown as ZohoClient;
	const cfg = overrides.cfg ?? cfgStub;
	mountSignup(app, {
		sessions,
		signup: signup as SignupService,
		eko,
		zoho,
		cfg,
	});
	return app;
}

const withCookie = { headers: { Cookie: "eps_at=token" } };

describe("signup route gate", () => {
	it("rejects a request with no session", async () => {
		const app = harness(null, {});
		const res = await app.request("/signup/state");
		expect(res.status).toBe(401);
	});

	it("rejects a developer session", async () => {
		const app = harness("developer", {});
		const res = await app.request("/signup/state", withCookie);
		expect(res.status).toBe(403);
		const errBody = (await res.json()) as { error: { code: string } };
		expect(errBody.error.code).toBe("NOT_SIGNUP_SESSION");
	});

	it("rejects an admin session", async () => {
		const app = harness("admin", {});
		const res = await app.request("/signup/state", withCookie);
		expect(res.status).toBe(403);
	});

	it("admits a signup session", async () => {
		const app = harness("signup", {
			getState: vi.fn().mockResolvedValue(inProgress),
		});
		const res = await app.request("/signup/state", withCookie);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual(inProgress);
	});
});

describe("signup endpoints", () => {
	it("POST /signup/profile creates the account for the session's own mobile", async () => {
		const createProfile = vi.fn().mockResolvedValue(inProgress);
		const app = harness("signup", { createProfile });
		const res = await app.request("/signup/profile", {
			method: "POST",
			...withCookie,
		});
		expect(res.status).toBe(200);
		// The mobile comes from the session, never from the request body.
		expect(createProfile).toHaveBeenCalledWith("9990000001", undefined);
	});

	it("POST /signup/pan submits the PAN", async () => {
		const submitPan = vi.fn().mockResolvedValue(inProgress);
		const app = harness("signup", { submitPan });
		const res = await app.request("/signup/pan", {
			method: "POST",
			headers: { ...withCookie.headers, "Content-Type": "application/json" },
			body: JSON.stringify({ pan: "ABCDE1234F" }),
		});
		expect(res.status).toBe(200);
		expect(submitPan).toHaveBeenCalledWith(
			"9990000001",
			"ABCDE1234F",
			undefined,
		);
	});

	it("POST /signup/pan rejects a malformed PAN before calling the service", async () => {
		const submitPan = vi.fn();
		const app = harness("signup", { submitPan });
		const res = await app.request("/signup/pan", {
			method: "POST",
			headers: { ...withCookie.headers, "Content-Type": "application/json" },
			body: JSON.stringify({ pan: "notapan" }),
		});
		expect(res.status).toBe(400);
		const errBody = (await res.json()) as { error: { code: string } };
		expect(errBody.error.code).toBe("INVALID_INPUT");
		expect(submitPan).not.toHaveBeenCalled();
	});

	it("POST /signup/pan uppercases the PAN before submitting", async () => {
		const submitPan = vi.fn().mockResolvedValue(inProgress);
		const app = harness("signup", { submitPan });
		await app.request("/signup/pan", {
			method: "POST",
			headers: { ...withCookie.headers, "Content-Type": "application/json" },
			body: JSON.stringify({ pan: "abcde1234f" }),
		});
		expect(submitPan).toHaveBeenCalledWith(
			"9990000001",
			"ABCDE1234F",
			undefined,
		);
	});

	it("POST /signup/pin submits both pins", async () => {
		const submitPin = vi
			.fn()
			.mockResolvedValue({ ...inProgress, status: "done" });
		const app = harness("signup", { submitPin });
		const res = await app.request("/signup/pin", {
			method: "POST",
			headers: { ...withCookie.headers, "Content-Type": "application/json" },
			body: JSON.stringify({ pin1: "1234", pin2: "1234" }),
		});
		expect(res.status).toBe(200);
		expect(submitPin).toHaveBeenCalledWith(
			"9990000001",
			"1234",
			"1234",
			undefined,
		);
	});

	it("surfaces a SignupStepError as a 400 with the upstream message", async () => {
		const app = harness("signup", {
			submitPan: vi
				.fn()
				.mockRejectedValue(new SignupStepError("PAN already in use", 1500)),
		});
		const res = await app.request("/signup/pan", {
			method: "POST",
			headers: { ...withCookie.headers, "Content-Type": "application/json" },
			body: JSON.stringify({ pan: "ABCDE1234F" }),
		});
		expect(res.status).toBe(400);
		const errBody = (await res.json()) as {
			error: { code: string; message: string };
		};
		expect(errBody.error.code).toBe("STEP_FAILED");
		expect(errBody.error.message).toBe("PAN already in use");
	});
});

describe("POST /signup/business", () => {
	const valid = {
		name: "Acme Retail",
		company_type: "4",
		authorized_signatory_name: "Asha Rao",
		contact_person_cell: "9876543210",
		alternate_mobile: "",
		current_address_line1: "12 MG Road, Indiranagar",
		current_address_line2: "",
		current_address_district: "Bengaluru",
		current_address_state: "Karnataka",
		current_address_pincode: "560038",
	};

	function post(app: Hono<AppEnv>, body: Record<string, unknown>) {
		return app.request("/signup/business", {
			method: "POST",
			headers: { ...withCookie.headers, "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
	}

	it("rejects a bad pincode without calling upstream", async () => {
		const submitBusiness = vi.fn();
		const app = harness("signup", { submitBusiness });
		const res = await post(app, { ...valid, current_address_pincode: "56" });
		expect(res.status).toBe(400);
		expect(submitBusiness).not.toHaveBeenCalled();
	});

	it("rejects a missing required field without calling upstream", async () => {
		const submitBusiness = vi.fn();
		const app = harness("signup", { submitBusiness });
		const res = await post(app, { ...valid, name: "" });
		expect(res.status).toBe(400);
		expect(submitBusiness).not.toHaveBeenCalled();
	});

	it("accepts a blank alternate_mobile", async () => {
		const submitBusiness = vi.fn().mockResolvedValue(inProgress);
		const app = harness("signup", { submitBusiness });
		const res = await post(app, { ...valid, alternate_mobile: "" });
		expect(res.status).toBe(200);
	});

	it("rejects a malformed alternate_mobile when supplied", async () => {
		const submitBusiness = vi.fn();
		const app = harness("signup", { submitBusiness });
		const res = await post(app, { ...valid, alternate_mobile: "12345" });
		expect(res.status).toBe(400);
		expect(submitBusiness).not.toHaveBeenCalled();
	});

	it("forwards the ten fields and takes mobile from the session, not the body", async () => {
		const submitBusiness = vi.fn().mockResolvedValue(inProgress);
		const app = harness("signup", { submitBusiness });
		await post(app, { ...valid, mobile: "9999999999" });
		expect(submitBusiness).toHaveBeenCalledWith(
			"9990000001",
			expect.objectContaining({ name: "Acme Retail" }),
			undefined,
		);
		const forwarded = submitBusiness.mock.calls[0][1];
		expect(forwarded).not.toHaveProperty("mobile");
	});

	it("requires a signup session", async () => {
		const app = harness(null, {});
		const res = await post(app, valid);
		expect(res.status).toBe(401);
	});
});

describe("session upgrade on completion", () => {
	const done: SignupState = {
		...inProgress,
		status: "done",
		steps: [],
		currentRole: null,
	};

	it("POST /signup/pin returning done sets a developer session cookie", async () => {
		const submitPin = vi.fn().mockResolvedValue(done);
		const mintAccess = vi.fn().mockResolvedValue("dev-access");
		const app = harness("signup", { submitPin }, { sessions: { mintAccess } });
		const res = await app.request("/signup/pin", {
			method: "POST",
			headers: { ...withCookie.headers, "Content-Type": "application/json" },
			body: JSON.stringify({ pin1: "1234", pin2: "1234" }),
		});
		expect(res.status).toBe(200);
		expect(res.headers.get("set-cookie")).toBeTruthy();
		expect(mintAccess).toHaveBeenCalledWith(
			expect.objectContaining({
				sub: "9990000001",
				role: "developer",
				orgId: 42,
				zohoId: "zoho-1",
			}),
		);
	});

	it("GET /signup/state returning done also upgrades a resumed, already-completed user", async () => {
		const getState = vi.fn().mockResolvedValue(done);
		const mintAccess = vi.fn().mockResolvedValue("dev-access");
		const app = harness("signup", { getState }, { sessions: { mintAccess } });
		const res = await app.request("/signup/state", withCookie);
		expect(res.status).toBe(200);
		expect(res.headers.get("set-cookie")).toBeTruthy();
		expect(mintAccess).toHaveBeenCalledWith(
			expect.objectContaining({ role: "developer" }),
		);
	});

	it("does not upgrade an in_progress state", async () => {
		const getState = vi.fn().mockResolvedValue(inProgress);
		const mintAccess = vi.fn();
		const app = harness("signup", { getState }, { sessions: { mintAccess } });
		const res = await app.request("/signup/state", withCookie);
		expect(res.status).toBe(200);
		expect(mintAccess).not.toHaveBeenCalled();
		expect(res.headers.get("set-cookie")).toBeNull();
	});

	it("still returns the done state when the upgrade's profile fetch fails, logging the error", async () => {
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => {});
		const upgradeError = new Error("upstream down");
		const submitPin = vi.fn().mockResolvedValue(done);
		const getProfile = vi.fn().mockRejectedValue(upgradeError);
		const mintAccess = vi.fn();
		const app = harness(
			"signup",
			{ submitPin },
			{ eko: { getProfile }, sessions: { mintAccess } },
		);
		const res = await app.request("/signup/pin", {
			method: "POST",
			headers: { ...withCookie.headers, "Content-Type": "application/json" },
			body: JSON.stringify({ pin1: "1234", pin2: "1234" }),
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual(done);
		expect(mintAccess).not.toHaveBeenCalled();
		expect(consoleError).toHaveBeenCalledWith(
			"[signup] session upgrade failed",
			upgradeError,
		);
		consoleError.mockRestore();
	});

	// buildMeView never throws for these three ProfileResult kinds — it resolves
	// them to a neutral/inactive MeView instead. Each one must still be refused
	// here exactly as POST /auth/otp/verify refuses it outright (403/403/502):
	// the done state comes back, but no developer session is minted.
	it.each([
		["inactive", { kind: "inactive", responseTypeId: 2123 }],
		["not_allowed", { kind: "not_allowed", responseTypeId: 369 }],
		["error", { kind: "error", responseTypeId: -1 }],
	])(
		"does not upgrade when the re-fetched profile is %s",
		async (_label, profileResult) => {
			const submitPin = vi.fn().mockResolvedValue(done);
			const getProfile = vi.fn().mockResolvedValue(profileResult);
			const mintAccess = vi.fn();
			const app = harness(
				"signup",
				{ submitPin },
				{ eko: { getProfile }, sessions: { mintAccess } },
			);
			const res = await app.request("/signup/pin", {
				method: "POST",
				headers: { ...withCookie.headers, "Content-Type": "application/json" },
				body: JSON.stringify({ pin1: "1234", pin2: "1234" }),
			});
			expect(res.status).toBe(200);
			expect(await res.json()).toEqual(done);
			expect(mintAccess).not.toHaveBeenCalled();
			expect(res.headers.get("set-cookie")).toBeNull();
		},
	);
});
