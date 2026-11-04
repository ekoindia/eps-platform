import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Sessions } from "../auth/session";
import type { EkoClient } from "../clients/eko";
import type { ZohoClient } from "../clients/zoho";
import { LEAD_FIELDS, LEAD_PICKLISTS } from "../clients/lead-fields";
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
		getLead: vi.fn(async () => ({
			id: LEAD_ID,
			Industry: "NGO",
			Lead_Status: "Qualified",
			Owner: { name: "Sales Rep" },
		})),
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
		const view = await body<{
			id: string;
			fields: Record<string, unknown>;
			picklists: unknown;
		}>(res);
		expect(view.id).toBe(LEAD_ID);
		expect(view.fields.Industry).toBe("NGO");
		expect(view.picklists).toEqual(LEAD_PICKLISTS);
		expect(zoho.getLead).toHaveBeenCalledWith(LEAD_ID);
	});

	// Only the whitelist leaves this service — sales-internal fields never reach
	// a browser or its cache.
	it("narrows the record to the whitelist, unset fields as null", async () => {
		const { app } = harness();
		const res = await app.request("/crm/lead", { headers: COOKIE });
		const { fields } = await body<{ fields: Record<string, unknown> }>(res);
		expect(Object.keys(fields).sort()).toEqual(Object.keys(LEAD_FIELDS).sort());
		expect(fields).not.toHaveProperty("Lead_Status");
		expect(fields).not.toHaveProperty("Owner");
		expect(fields).not.toHaveProperty("id");
		expect(fields.GST_No).toBeNull();
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

	it("403 for an admin session", async () => {
		const { app } = harness({ role: "admin" });
		const res = await app.request("/crm/lead", { headers: COOKIE });
		expect(res.status).toBe(403);
	});

	// The wizard refreshes the Lead after each onboarding step.
	it("serves a signup session too", async () => {
		const { app } = harness({ role: "signup" });
		const res = await app.request("/crm/lead", { headers: COOKIE });
		expect(res.status).toBe(200);
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

	it("writes the fields and answers with them, without re-reading", async () => {
		const { app, zoho } = harness();
		const res = await app.request(
			"/crm/lead",
			patch({ Industry: "IT/Software", Website: "https://acme.test" }),
		);
		expect(res.status).toBe(200);
		expect(zoho.updateLead).toHaveBeenCalledWith(LEAD_ID, {
			Industry: "IT/Software",
			Website: "https://acme.test",
		});
		expect(await body(res)).toEqual({
			id: LEAD_ID,
			updated: { Industry: "IT/Software", Website: "https://acme.test" },
		});
		// Nothing here is write-once, so no read at all.
		expect(zoho.getLead).not.toHaveBeenCalled();
	});

	it("accepts a write-once field while the Lead's value is empty", async () => {
		const { app, zoho } = harness({
			zoho: { getLead: vi.fn(async () => ({ utm_source: null })) },
		});
		const res = await app.request("/crm/lead", patch({ utm_source: "google" }));
		expect(res.status).toBe(200);
		expect(zoho.getLead).toHaveBeenCalledWith(LEAD_ID);
		expect(zoho.updateLead).toHaveBeenCalledWith(LEAD_ID, {
			utm_source: "google",
		});
	});

	// Attribution is captured once; a partner must not rewrite it later.
	it("409s a write-once field the Lead already holds, and writes nothing", async () => {
		const { app, zoho } = harness({
			zoho: { getLead: vi.fn(async () => ({ utm_source: "linkedin" })) },
		});
		const res = await app.request(
			"/crm/lead",
			patch({ City: "Pune", utm_source: "google" }),
		);
		expect(res.status).toBe(409);
		expect((await body<{ error: { code: string } }>(res)).error.code).toBe(
			"FIELD_ALREADY_SET",
		);
		expect(zoho.updateLead).not.toHaveBeenCalled();
	});

	it("502s when the write-once check cannot read the Lead", async () => {
		const { app, zoho } = harness({
			zoho: {
				getLead: vi.fn(async () => {
					throw new ZohoError("down");
				}),
			},
		});
		const res = await app.request("/crm/lead", patch({ Ad_ID: "123" }));
		expect(res.status).toBe(502);
		expect(zoho.updateLead).not.toHaveBeenCalled();
	});

	it("400s on a field outside the whitelist or read-only, and writes nothing", async () => {
		const { app, zoho } = harness();
		for (const fields of [
			{ Lead_Status: "Won" },
			{ Company: "Acme" }, // dropped from the whitelist: nothing uses it
			{ Eko_Code: "18120001" },
			{ Pro_Required: ["DMT"] },
		]) {
			const res = await app.request("/crm/lead", patch(fields));
			expect(res.status).toBe(400);
			expect((await body<{ error: { code: string } }>(res)).error.code).toBe(
				"FIELD_NOT_WRITABLE",
			);
		}
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
		const res = await app.request("/crm/lead", patch({ City: "Pune" }));
		expect(res.status).toBe(502);
	});

	it("429 once the write window is exhausted", async () => {
		const { app } = harness();
		let last = 0;
		for (let i = 0; i < 22; i++) {
			last = (await app.request("/crm/lead", patch({ City: "Pune" }))).status;
		}
		expect(last).toBe(429);
	});

	it("401 without a session, and 403 for an admin or signup session", async () => {
		expect(
			(await harness({ role: null }).app.request("/crm/lead", patch({})))
				.status,
		).toBe(401);
		for (const role of ["admin", "signup"]) {
			expect(
				(await harness({ role }).app.request("/crm/lead", patch({}))).status,
			).toBe(403);
		}
	});
});

describe("POST /crm/lead/attribution", () => {
	const URL_GADS = "https://eps.eko.in/aeps/?gclid=G1&utm_campaign=q4";
	const SOURCE = "https://eps.eko.in/signup/?gclid=G1&utm_campaign=q4";
	const post = (payload: unknown) => ({
		method: "POST",
		headers: { ...COOKIE, "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});

	it("derives the fields and writes them, for a signup session", async () => {
		const { app, zoho } = harness({ role: "signup" });
		const res = await app.request(
			"/crm/lead/attribution",
			post({ url: URL_GADS, sourceWebsite: SOURCE }),
		);
		expect(res.status).toBe(200);
		const expected = {
			First_Visited_URL: URL_GADS,
			SEO_Page_Name: "aeps/",
			utm_source: "google",
			utm_campaign: "q4",
			Ad_ID: "G1",
			Source_Website: SOURCE,
		};
		expect(zoho.updateLead).toHaveBeenCalledWith(LEAD_ID, expected);
		expect(await body(res)).toEqual({ id: LEAD_ID, updated: expected });
	});

	it("writes only fields the Lead does not already hold", async () => {
		const { app, zoho } = harness({
			zoho: {
				getLead: vi.fn(async () => ({
					id: LEAD_ID,
					utm_source: "partner-referral",
					Ad_ID: "",
				})),
			},
		});
		await app.request("/crm/lead/attribution", post({ url: URL_GADS }));
		const written = vi.mocked(zoho.updateLead).mock.calls[0][1];
		expect(written).not.toHaveProperty("utm_source");
		expect(written).toMatchObject({ Ad_ID: "G1" });
	});

	it("answers updated {} and writes nothing when all is recorded", async () => {
		const { app, zoho } = harness({
			zoho: {
				getLead: vi.fn(async () => ({
					id: LEAD_ID,
					First_Visited_URL: "https://eps.eko.in/",
				})),
			},
		});
		const res = await app.request(
			"/crm/lead/attribution",
			post({ url: "https://eps.eko.in/docs/" }),
		);
		expect(res.status).toBe(200);
		expect(await body(res)).toEqual({
			id: LEAD_ID,
			updated: { SEO_Page_Name: "docs/" },
		});
		const { app: app2, zoho: zoho2 } = harness({
			zoho: {
				getLead: vi.fn(async () => ({
					id: LEAD_ID,
					First_Visited_URL: "https://eps.eko.in/",
				})),
			},
		});
		const res2 = await app2.request(
			"/crm/lead/attribution",
			post({ url: "https://eps.eko.in/" }),
		);
		expect(await body(res2)).toEqual({ id: LEAD_ID, updated: {} });
		expect(zoho2.updateLead).not.toHaveBeenCalled();
		expect(zoho.updateLead).toHaveBeenCalledTimes(1);
	});

	it("400s on a missing or non-http url, and drops a bad sourceWebsite", async () => {
		for (const url of [undefined, "javascript:alert(1)", "/relative"]) {
			const { app, zoho } = harness();
			const res = await app.request("/crm/lead/attribution", post({ url }));
			expect(res.status).toBe(400);
			expect(zoho.getLead).not.toHaveBeenCalled();
		}
		const { app, zoho } = harness();
		await app.request(
			"/crm/lead/attribution",
			post({ url: "https://eps.eko.in/", sourceWebsite: "ftp://x" }),
		);
		expect(vi.mocked(zoho.updateLead).mock.calls[0][1]).toEqual({
			First_Visited_URL: "https://eps.eko.in/",
		});
	});

	it("trims an over-long Source_Website instead of dropping it", async () => {
		const { app, zoho } = harness();
		const long = `https://eps.eko.in/signup/?gclid=G1&sel=${"a".repeat(600)}`;
		await app.request(
			"/crm/lead/attribution",
			post({ url: "https://eps.eko.in/", sourceWebsite: long }),
		);
		const written = vi.mocked(zoho.updateLead).mock.calls[0][1] as Record<
			string,
			string
		>;
		expect(written.Source_Website).toHaveLength(450);
		expect(written.Source_Website).toBe(`${long.slice(0, 449)}…`);
	});

	it("400s on a url past the 8K sanity cap", async () => {
		const { app } = harness();
		const res = await app.request(
			"/crm/lead/attribution",
			post({ url: `https://eps.eko.in/?q=${"x".repeat(8200)}` }),
		);
		expect(res.status).toBe(400);
	});

	it("403 for an admin session", async () => {
		const { app } = harness({ role: "admin" });
		const res = await app.request(
			"/crm/lead/attribution",
			post({ url: URL_GADS }),
		);
		expect(res.status).toBe(403);
	});
});

describe("parseLeadPatch", () => {
	const code = (fn: () => unknown) => {
		try {
			fn();
		} catch (err) {
			return (err as AppError).code;
		}
		return null;
	};

	it("accepts a well-typed value for every kind of writable field", () => {
		const ok = {
			Industry: "IT/Software",
			Annual_Turnover: "\u20b9 5 \u2013 25 crore",
			States: "Karnataka",
			Count_of_Directors: 3,
			Activation_Fee_Paid_INR: 4999.5,
			Activation_Fee_Discount: 12.5,
			Activation_Fee_Status: "Payment claimed",
			Description: "x".repeat(5000),
			Zip_Code: "560001",
			utm_device: "m",
			First_Visited_URL: "https://eps.eko.in/pricing?utm_source=google",
		};
		expect(parseLeadPatch(ok)).toEqual(ok);
	});

	// One character off is a different option — a hyphen where Zoho has an en
	// dash, or a tidied space, must not reach the CRM.
	it("refuses a picklist value that is not exactly a listed option", () => {
		for (const patch of [
			{ Number_of_Employees: "51 - 200" },
			{ Annual_Turnover: "\u20b95 \u2013 25 crore" },
			{ Industry: "Large Enterprise" },
			{ States: "Option 1" },
			{ Number_of_Employees: 1 },
		]) {
			expect(code(() => parseLeadPatch(patch))).toBe("INVALID_FIELD_VALUE");
		}
	});

	// Finance's verdicts stay finance's — a partner may only say they paid.
	it("lets a partner claim payment, never mark it paid", () => {
		expect(
			parseLeadPatch({ Activation_Fee_Status: "Payment claimed" }),
		).toEqual({
			Activation_Fee_Status: "Payment claimed",
		});
		for (const status of ["Paid", "Unpaid", "Partially paid"]) {
			expect(
				code(() => parseLeadPatch({ Activation_Fee_Status: status })),
			).toBe("INVALID_FIELD_VALUE");
		}
	});

	it("enforces each field's Zoho type and length", () => {
		for (const patch of [
			{ Count_of_Directors: 100 }, // Zoho length 2
			{ Count_of_Directors: 2.5 },
			{ Count_of_Directors: "3" },
			{ Activation_Fee_Paid_INR: -1 },
			{ Activation_Fee_Discount: 101 },
			{ utm_device: "mobile" }, // Zoho length 2
			{ City: "x".repeat(101) },
			{ GST_No: 7 },
			{ City: { a: 1 } },
		]) {
			expect(code(() => parseLeadPatch(patch))).toBe("INVALID_FIELD_VALUE");
		}
	});

	// Values may be replaced, never erased — and the console never needs to
	// send an empty one, so none reaches the CRM by any route.
	it("refuses null and blank values for every field", () => {
		for (const value of [null, "", "   "]) {
			for (const field of ["Industry", "GST_No", "Website"]) {
				expect(code(() => parseLeadPatch({ [field]: value }))).toBe(
					"FIELD_REQUIRED",
				);
			}
		}
	});

	it("refuses prototype keys", () => {
		expect(code(() => parseLeadPatch({ constructor: "x" }))).toBe(
			"FIELD_NOT_WRITABLE",
		);
		// Via JSON.parse, so `__proto__` is a real own key rather than a setter.
		expect(code(() => parseLeadPatch(JSON.parse('{"__proto__":"x"}')))).toBe(
			"FIELD_NOT_WRITABLE",
		);
	});
});
