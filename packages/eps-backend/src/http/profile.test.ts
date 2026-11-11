import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Sessions } from "../auth/session";
import type { EkoClient } from "../clients/eko";
import { createInMemoryKV } from "../store/kv";
import type { EkoProfile, ProfileResult } from "../types";
import { AppError, errorBody } from "./errors";
import { mountProfile, parseProfilePatch } from "./profile";
import type { AppEnv } from "./requestId";
import { trace } from "./trace";

const COOKIE = { Cookie: "eps_at=token", "Content-Type": "application/json" };

const FOUND: ProfileResult = {
	kind: "found",
	responseTypeId: 1,
	profile: { mobile: "9990000001", code: 20810001, orgId: 1 } as EkoProfile,
};

function harness(
	opts: {
		role?: string;
		profileResult?: ProfileResult;
		updateGstin?: EkoClient["updateGstin"];
	} = {},
) {
	const app = new Hono<AppEnv>();
	app.use("*", trace());
	// Mirrors app.ts's onError so status/code assertions match production.
	app.onError((err, c) => {
		if (err instanceof AppError) {
			return c.json(
				errorBody(err.code, err.message, err.details, err.source),
				err.status as never,
			);
		}
		return c.json(errorBody("UPSTREAM_ERROR", "Something went wrong"), 500);
	});
	const sessions = {
		verifyAccess: vi.fn().mockResolvedValue({
			sub: "9990000001",
			role: opts.role ?? "developer",
			orgId: 1,
		}),
	} as unknown as Sessions;
	const updateGstin = vi.fn(
		opts.updateGstin ?? (async () => ({ ok: true as const })),
	);
	const eko = {
		getProfile: vi.fn().mockResolvedValue(opts.profileResult ?? FOUND),
		updateGstin,
	} as unknown as EkoClient;
	mountProfile(app, { sessions, eko, kv: createInMemoryKV() });
	return { app, updateGstin };
}

const patch = (app: Hono<AppEnv>, body: unknown) =>
	app.request("/profile", {
		method: "PATCH",
		headers: COOKIE,
		body: JSON.stringify(body),
	});

describe("PATCH /profile", () => {
	it("writes the gstin to the Eko profile as the caller", async () => {
		const { app, updateGstin } = harness();
		const res = await patch(app, { gstin: " 07aaaca1234a1z5 " });
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ updated: { gstin: "07AAACA1234A1Z5" } });
		expect(updateGstin).toHaveBeenCalledWith(
			expect.objectContaining({
				gstin: "07AAACA1234A1Z5",
				identity: { initiatorId: "9990000001", userCode: "20810001", orgId: 1 },
			}),
		);
	});

	it("passes upstream's refusal back as a 400 with its message", async () => {
		const { app } = harness({
			updateGstin: async () => ({
				ok: false,
				message: "GSTIN does not match PAN",
				responseTypeId: 7,
			}),
		});
		const res = await patch(app, { gstin: "07AAACA1234A1Z5" });
		expect(res.status).toBe(400);
		expect(await res.json()).toMatchObject({
			error: {
				code: "PROFILE_UPDATE_REJECTED",
				message: "GSTIN does not match PAN",
			},
		});
	});

	it("refuses a session that isn't a developer's", async () => {
		const { app, updateGstin } = harness({ role: "signup" });
		const res = await patch(app, { gstin: "07AAACA1234A1Z5" });
		expect(res.status).toBe(403);
		expect(updateGstin).not.toHaveBeenCalled();
	});

	it("refuses an account with no active profile", async () => {
		const { app, updateGstin } = harness({
			profileResult: { kind: "not_found", responseTypeId: 2 } as ProfileResult,
		});
		const res = await patch(app, { gstin: "07AAACA1234A1Z5" });
		expect(res.status).toBe(403);
		expect(updateGstin).not.toHaveBeenCalled();
	});
});

describe("parseProfilePatch", () => {
	it.each([
		[null, "INVALID_INPUT"],
		[{ gstin: "07AAACA" }, "INVALID_FIELD_VALUE"],
		[{ gstin: 7 }, "INVALID_FIELD_VALUE"],
		[{ gstin: "07AAACA1234A1Z5", name: "x" }, "FIELD_NOT_WRITABLE"],
	])("refuses %j", (body, code) => {
		expect(() => parseProfilePatch(body)).toThrowError(
			expect.objectContaining({ status: 400, code }),
		);
	});
});
