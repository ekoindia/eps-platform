import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Sessions } from "../auth/session";
import type { EkoClient } from "../clients/eko";
import type { ZohoClient } from "../clients/zoho";
import { ZohoError } from "../clients/zoho";
import { createInMemoryKV, type KV } from "../store/kv";
import { mountCrm, parseLeadPatch } from "./crm";
import { AppError, errorBody } from "./errors";
import type { AppEnv } from "./requestId";
import { trace } from "./trace";
import type { EkoProfile, ProfileResult } from "../types";

const COOKIE = { Cookie: "eps_at=token" };
const LEAD_ID = "5545974000000317001";

function profile(userDetail: Record<string, unknown>): ProfileResult {
	return {
		kind: "found",
		responseTypeId: 1,
		profile: { zohoId: "contact-1", userDetail } as unknown as EkoProfile,
	};
}

function harness(
	opts: {
		role?: string | null;
		enabled?: boolean;
		profileResult?: ProfileResult;
		zoho?: Partial<ZohoClient>;
		kv?: KV;
	} = {},
) {
	const role = opts.role === undefined ? "developer" : opts.role;
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
		verifyAccess: vi
			.fn()
			.mockResolvedValue(role ? { sub: "9990000001", role, orgId: 1 } : null),
	} as unknown as Sessions;

	const getProfile = vi
		.fn()
		.mockResolvedValue(opts.profileResult ?? profile({ crm_lead_id: LEAD_ID }));
	const eko = { getProfile } as unknown as EkoClient;

	const zoho = {
		findLead: vi.fn(async () => false),
		getLead: vi.fn(async () => ({ id: LEAD_ID, Company: "Acme" })),
		updateLead: vi.fn(async () => {}),
		...opts.zoho,
	} as unknown as ZohoClient;

	mountCrm(app, {
		sessions,
		eko,
		zoho,
		kv: opts.kv ?? createInMemoryKV(),
		enabled: opts.enabled ?? true,
	});
	return { app, zoho, eko, getProfile };
}

const body = async <T>(res: Response): Promise<T> => (await res.json()) as T;

describe("GET /crm/lead", () => {
	it("returns the partner's own record", async () => {
		const { app, zoho } = harness();
		const res = await app.request("/crm/lead", { headers: COOKIE });
		expect(res.status).toBe(200);
		expect(await body(res)).toEqual({
			id: LEAD_ID,
			fields: { id: LEAD_ID, Company: "Acme" },
		});
		expect(zoho.getLead).toHaveBeenCalledWith(LEAD_ID);
	});

	// The record id is the partner's, from their upstream profile — a caller
	// cannot name someone else's.
	it("ignores an id supplied by the caller", async () => {
		const { app, zoho } = harness();
		await app.request("/crm/lead?id=9999999999999999999", { headers: COOKIE });
		expect(zoho.getLead).toHaveBeenCalledWith(LEAD_ID);
	});

	it("401 without a session", async () => {
		const { app } = harness({ role: null });
		const res = await app.request("/crm/lead");
		expect(res.status).toBe(401);
	});

	it("403 for an admin or signup session", async () => {
		for (const role of ["admin", "signup"]) {
			const { app } = harness({ role });
			const res = await app.request("/crm/lead", { headers: COOKIE });
			expect(res.status).toBe(403);
		}
	});

	it("404 when Zoho is not configured for this deployment", async () => {
		const { app, eko } = harness({ enabled: false });
		const res = await app.request("/crm/lead", { headers: COOKIE });
		expect(res.status).toBe(404);
		expect((await body<{ error: { code: string } }>(res)).error.code).toBe(
			"CRM_DISABLED",
		);
		// And it never spent an upstream profile call to find that out.
		expect(eko.getProfile).not.toHaveBeenCalled();
	});

	it("404 when the profile carries no crm_lead_id", async () => {
		const { app } = harness({ profileResult: profile({}) });
		const res = await app.request("/crm/lead", { headers: COOKIE });
		expect(res.status).toBe(404);
		expect((await body<{ error: { code: string } }>(res)).error.code).toBe(
			"NO_CRM_LEAD",
		);
	});

	it("404 when the CRM has no such record", async () => {
		const { app } = harness({ zoho: { getLead: vi.fn(async () => null) } });
		const res = await app.request("/crm/lead", { headers: COOKIE });
		expect(res.status).toBe(404);
	});

	// Fails CLOSED, unlike findLead on the login path: an empty record would
	// render as "you have no details".
	it("502 without leaking the upstream message when the CRM is down", async () => {
		const { app } = harness({
			zoho: {
				getLead: vi.fn(async () => {
					throw new ZohoError("getLead failed: 500 Lead_Status invalid");
				}),
			},
		});
		const res = await app.request("/crm/lead", { headers: COOKIE });
		expect(res.status).toBe(502);
		const err = (await body<{ error: { code: string; message: string } }>(res))
			.error;
		expect(err.code).toBe("CRM_UNAVAILABLE");
		expect(err.message).not.toContain("Lead_Status");
	});

	it("429 once the read window is exhausted", async () => {
		const kv = createInMemoryKV();
		const { app } = harness({ kv });
		let last = 0;
		for (let i = 0; i < 62; i++) {
			last = (await app.request("/crm/lead", { headers: COOKIE })).status;
		}
		expect(last).toBe(429);
	});
});

describe("PATCH /crm/lead", () => {
	const patch = (fields: unknown) => ({
		method: "PATCH",
		headers: { ...COOKIE, "Content-Type": "application/json" },
		body: JSON.stringify(fields),
	});

	it("writes an allow-listed field and returns the re-read record", async () => {
		const { app, zoho } = harness();
		const res = await app.request(
			"/crm/lead",
			patch({ Company: "Acme", Website: "https://acme.test" }),
		);
		expect(res.status).toBe(200);
		expect(zoho.updateLead).toHaveBeenCalledWith(LEAD_ID, {
			Company: "Acme",
			Website: "https://acme.test",
		});
		expect(await body(res)).toEqual({
			id: LEAD_ID,
			fields: { id: LEAD_ID, Company: "Acme" },
		});
	});

	// Rejected loudly: a key silently dropped looks to the console exactly like
	// a successful save.
	it("400s on a field outside the allowlist, and writes nothing", async () => {
		const { app, zoho } = harness();
		const res = await app.request("/crm/lead", patch({ Lead_Status: "Won" }));
		expect(res.status).toBe(400);
		expect((await body<{ error: { code: string } }>(res)).error.code).toBe(
			"FIELD_NOT_WRITABLE",
		);
		expect(zoho.updateLead).not.toHaveBeenCalled();
	});

	it("400s on an empty, non-object or unparseable body", async () => {
		const { app, zoho } = harness();
		for (const b of [{}, [], null, "nope", 7]) {
			expect((await app.request("/crm/lead", patch(b))).status).toBe(400);
		}
		expect(zoho.updateLead).not.toHaveBeenCalled();
	});

	it("502 when the CRM refuses the write", async () => {
		const { app } = harness({
			zoho: {
				updateLead: vi.fn(async () => {
					throw new ZohoError("updateLead rejected: INVALID_DATA");
				}),
			},
		});
		const res = await app.request("/crm/lead", patch({ Company: "Acme" }));
		expect(res.status).toBe(502);
	});

	// The write committed. Answering 502 here would invite a retry of a save
	// that already landed.
	it("200s with fields:null when the write lands but the read-back fails", async () => {
		const { app } = harness({
			zoho: {
				getLead: vi.fn(async () => {
					throw new ZohoError("boom");
				}),
			},
		});
		const res = await app.request("/crm/lead", patch({ Company: "Acme" }));
		expect(res.status).toBe(200);
		expect(await body(res)).toEqual({ id: LEAD_ID, fields: null });
	});

	it("429 once the write window is exhausted", async () => {
		const { app } = harness();
		let last = 0;
		for (let i = 0; i < 22; i++) {
			last = (await app.request("/crm/lead", patch({ Company: "Acme" })))
				.status;
		}
		expect(last).toBe(429);
	});

	it("401 without a session, and 403 for an admin session", async () => {
		expect(
			(await harness({ role: null }).app.request("/crm/lead", patch({})))
				.status,
		).toBe(401);
		expect(
			(await harness({ role: "admin" }).app.request("/crm/lead", patch({})))
				.status,
		).toBe(403);
	});
});

describe("parseLeadPatch", () => {
	it("passes scalars through", () => {
		expect(
			parseLeadPatch({
				Company: "Acme",
				Activation_Fee_Paid_INR: 4999,
				Pro_Required: true,
				Website: "",
				GST_No: null,
			}),
		).toEqual({
			Company: "Acme",
			Activation_Fee_Paid_INR: 4999,
			Pro_Required: true,
			Website: "",
			GST_No: null,
		});
	});

	it("refuses non-scalar values, over-long strings and prototype keys", () => {
		expect(() => parseLeadPatch({ Company: { a: 1 } })).toThrow(AppError);
		expect(() => parseLeadPatch({ Company: ["a"] })).toThrow(AppError);
		expect(() => parseLeadPatch({ Company: "x".repeat(501) })).toThrow(
			AppError,
		);
		expect(() => parseLeadPatch({ constructor: "x" })).toThrow(AppError);
		// Via JSON.parse, so `__proto__` is a real own key rather than a setter.
		expect(() => parseLeadPatch(JSON.parse('{"__proto__":"x"}'))).toThrow(
			AppError,
		);
	});
});
