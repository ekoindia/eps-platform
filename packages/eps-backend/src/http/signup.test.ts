import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Sessions } from "../auth/session";
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

/** Builds an app with a session double that returns `role` for any cookie. */
function harness(role: string | null, signup: Partial<SignupService>) {
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
	} as unknown as Sessions;
	mountSignup(app, { sessions, signup: signup as SignupService });
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
		expect(submitPan).toHaveBeenCalledWith("9990000001", "ABCDE1234F", undefined);
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
		expect(submitPan).toHaveBeenCalledWith("9990000001", "ABCDE1234F", undefined);
	});

	it("POST /signup/pin submits both pins", async () => {
		const submitPin = vi.fn().mockResolvedValue({ ...inProgress, status: "done" });
		const app = harness("signup", { submitPin });
		const res = await app.request("/signup/pin", {
			method: "POST",
			headers: { ...withCookie.headers, "Content-Type": "application/json" },
			body: JSON.stringify({ pin1: "1234", pin2: "1234" }),
		});
		expect(res.status).toBe(200);
		expect(submitPin).toHaveBeenCalledWith("9990000001", "1234", "1234", undefined);
	});

	it("surfaces a SignupStepError as a 400 with the upstream message", async () => {
		const app = harness("signup", {
			submitPan: vi.fn().mockRejectedValue(new SignupStepError("PAN already in use", 1500)),
		});
		const res = await app.request("/signup/pan", {
			method: "POST",
			headers: { ...withCookie.headers, "Content-Type": "application/json" },
			body: JSON.stringify({ pan: "ABCDE1234F" }),
		});
		expect(res.status).toBe(400);
		const errBody = (await res.json()) as { error: { code: string; message: string } };
		expect(errBody.error.code).toBe("STEP_FAILED");
		expect(errBody.error.message).toBe("PAN already in use");
	});
});
