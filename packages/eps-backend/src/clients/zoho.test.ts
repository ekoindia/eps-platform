import type { Mock } from "vitest";
import { describe, expect, it, vi } from "vitest";
import type { Config } from "../config";
import { createZohoClient, isWritableLeadField, ZohoError } from "./zoho";

const OFF: Config["zoho"] = {
	enabled: false,
	baseUrl: "https://www.zohoapis.test",
	accountsUrl: "https://accounts.zoho.test",
};

const ON: Config["zoho"] = {
	...OFF,
	enabled: true,
	clientId: "cid",
	clientSecret: "secret",
	refreshToken: "rtok",
};

/** A token grant, then the queued CRM responses in order. */
function stubFetch(...responses: Response[]) {
	const queue = [...responses];
	const f = vi.fn(async (input: string | URL | Request) => {
		const url = String(input);
		if (url.includes("/oauth/v2/token")) {
			return new Response(
				JSON.stringify({ access_token: "at-1", expires_in: 3600 }),
				{ status: 200 },
			);
		}
		return queue.shift() ?? new Response("{}", { status: 200 });
	});
	return f as unknown as typeof fetch & Mock;
}

const calls = (f: typeof fetch) => (f as unknown as Mock).mock.calls;
const crmCalls = (f: typeof fetch) =>
	calls(f).filter(([u]) => !String(u).includes("/oauth/"));
const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status });

describe("createZohoClient — OAuth", () => {
	it("mints one token and reuses it across calls", async () => {
		const f = stubFetch(json({ data: [] }), json({ data: [] }));
		const z = createZohoClient(ON, f);
		await z.findLead("9999999999");
		await z.findLead("8888888888");
		const grants = calls(f).filter(([u]) =>
			String(u).includes("/oauth/v2/token"),
		);
		expect(grants.length).toBe(1);
		expect(String(grants[0][0])).toContain("grant_type=refresh_token");
		expect(crmCalls(f)[0][1].headers.Authorization).toBe(
			"Zoho-oauthtoken at-1",
		);
	});

	it("concurrent cold callers share one grant", async () => {
		const f = stubFetch(json({ data: [] }), json({ data: [] }));
		const z = createZohoClient(ON, f);
		await Promise.all([z.findLead("1111111111"), z.findLead("2222222222")]);
		expect(
			calls(f).filter(([u]) => String(u).includes("/oauth/v2/token")).length,
		).toBe(1);
	});

	// Zoho answers a bad grant with HTTP 200 and an `error` body, so a status
	// check alone reports "no access_token" and hides the actual reason.
	it("surfaces an OAuth error delivered as HTTP 200", async () => {
		const f = vi.fn(async () =>
			json({ error: "invalid_client" }),
		) as unknown as typeof fetch;
		const z = createZohoClient(ON, f);
		await expect(z.getLead("1234567890")).rejects.toThrow(/invalid_client/);
	});

	it("refreshes and retries exactly once on a 401", async () => {
		let grants = 0;
		let crm = 0;
		const f = vi.fn(async (input: string | URL | Request) => {
			if (String(input).includes("/oauth/v2/token")) {
				grants += 1;
				return json({ access_token: `at-${grants}`, expires_in: 3600 });
			}
			crm += 1;
			return crm === 1
				? new Response("expired", { status: 401 })
				: json({ data: [{ id: "1234567890", Company: "Acme" }] });
		}) as unknown as typeof fetch;
		const z = createZohoClient(ON, f);
		expect(await z.getLead("1234567890")).toEqual({
			id: "1234567890",
			Company: "Acme",
		});
		expect(grants).toBe(2);
		expect(crm).toBe(2);
	});

	it("does not loop when the retry 401s too", async () => {
		const f = vi.fn(async (input: string | URL | Request) =>
			String(input).includes("/oauth/v2/token")
				? json({ access_token: "at", expires_in: 3600 })
				: new Response("nope", { status: 401 }),
		) as unknown as typeof fetch;
		const z = createZohoClient(ON, f);
		await expect(z.getLead("1234567890")).rejects.toBeInstanceOf(ZohoError);
		expect(crmCalls(f).length).toBe(2);
	});

	// A missing expires_in must not cache a NaN deadline (token kept forever).
	it("still caches when Zoho sends no expires_in", async () => {
		const f = vi.fn(async (input: string | URL | Request) =>
			String(input).includes("/oauth/v2/token")
				? json({ access_token: "at" })
				: json({ data: [] }),
		) as unknown as typeof fetch;
		const z = createZohoClient(ON, f);
		await z.findLead("9999999999");
		await z.findLead("9999999999");
		expect(
			calls(f).filter(([u]) => String(u).includes("/oauth/v2/token")).length,
		).toBe(1);
	});
});

describe("createZohoClient — findLead (fail-open)", () => {
	it("disabled → false, no fetch", async () => {
		const f = vi.fn() as unknown as typeof fetch;
		const z = createZohoClient(OFF, f);
		expect(await z.findLead("9999999999")).toBe(false);
		expect(calls(f).length).toBe(0);
	});

	it("enabled but credentials missing → false, no fetch", async () => {
		const f = vi.fn() as unknown as typeof fetch;
		const z = createZohoClient({ ...OFF, enabled: true }, f);
		expect(await z.findLead("9999999999")).toBe(false);
		expect(calls(f).length).toBe(0);
	});

	it("lead found → true, and searches the Leads module by phone", async () => {
		const f = stubFetch(json({ data: [{ id: "1" }] }));
		const z = createZohoClient(ON, f);
		expect(await z.findLead("9999999999")).toBe(true);
		expect(String(crmCalls(f)[0][0])).toBe(
			"https://www.zohoapis.test/crm/v3/Leads/search?phone=9999999999",
		);
	});

	it("no data → false", async () => {
		const f = stubFetch(json({ data: [] }));
		expect(await createZohoClient(ON, f).findLead("9999999999")).toBe(false);
	});

	// A CRM outage on the login path must never block a login.
	it("swallows a non-2xx, unparseable JSON, and a transport error", async () => {
		const bad = stubFetch(new Response("boom", { status: 500 }));
		expect(await createZohoClient(ON, bad).findLead("9999999999")).toBe(false);

		const junk = stubFetch(new Response("<html>", { status: 200 }));
		expect(await createZohoClient(ON, junk).findLead("9999999999")).toBe(false);

		const dead = vi.fn(async () => {
			throw new Error("ECONNRESET");
		}) as unknown as typeof fetch;
		expect(await createZohoClient(ON, dead).findLead("9999999999")).toBe(false);
	});
});

describe("createZohoClient — getLead", () => {
	it("returns the first record", async () => {
		const f = stubFetch(
			json({ data: [{ id: "1234567890", Company: "Acme" }] }),
		);
		const z = createZohoClient(ON, f);
		expect(await z.getLead("1234567890")).toEqual({
			id: "1234567890",
			Company: "Acme",
		});
		expect(String(crmCalls(f)[0][0])).toBe(
			"https://www.zohoapis.test/crm/v3/Leads/1234567890",
		);
	});

	it("204 and 404 → null", async () => {
		expect(
			await createZohoClient(
				ON,
				stubFetch(new Response(null, { status: 204 })),
			).getLead("1234567890"),
		).toBeNull();
		expect(
			await createZohoClient(
				ON,
				stubFetch(new Response("", { status: 404 })),
			).getLead("1234567890"),
		).toBeNull();
	});

	it("other non-2xx throws — these routes must fail closed", async () => {
		const z = createZohoClient(
			ON,
			stubFetch(new Response("x", { status: 500 })),
		);
		await expect(z.getLead("1234567890")).rejects.toBeInstanceOf(ZohoError);
	});

	it("rejects an id that is not a Zoho record id, before any fetch", async () => {
		const f = stubFetch();
		const z = createZohoClient(ON, f);
		await expect(z.getLead("../Contacts/9")).rejects.toThrow(/record id/);
		await expect(z.getLead("")).rejects.toThrow(/record id/);
		expect(crmCalls(f).length).toBe(0);
	});

	it("throws when Zoho is disabled", async () => {
		await expect(createZohoClient(OFF).getLead("1234567890")).rejects.toThrow(
			/not configured/,
		);
	});
});

describe("createZohoClient — updateLead", () => {
	it("PUTs the fields and accepts a SUCCESS result", async () => {
		const f = stubFetch(json({ data: [{ code: "SUCCESS" }] }));
		const z = createZohoClient(ON, f);
		await z.updateLead("1234567890", { Company: "Acme" });
		const [url, init] = crmCalls(f)[0];
		expect(String(url)).toBe(
			"https://www.zohoapis.test/crm/v3/Leads/1234567890",
		);
		expect(init.method).toBe("PUT");
		expect(JSON.parse(init.body)).toEqual({ data: [{ Company: "Acme" }] });
	});

	// Zoho reports a rejected field inside a 200 body, so an unchecked call
	// reports success while nothing was written.
	it("throws on a per-record failure inside a 200", async () => {
		const f = stubFetch(
			json({ data: [{ code: "INVALID_DATA", message: "invalid picklist" }] }),
		);
		await expect(
			createZohoClient(ON, f).updateLead("1234567890", { Company: "x" }),
		).rejects.toThrow(/INVALID_DATA/);
	});

	it("throws on an empty result body", async () => {
		const f = stubFetch(json({}));
		await expect(
			createZohoClient(ON, f).updateLead("1234567890", { Company: "x" }),
		).rejects.toThrow(/no result/);
	});

	it("throws on a non-2xx", async () => {
		const f = stubFetch(new Response("nope", { status: 400 }));
		await expect(
			createZohoClient(ON, f).updateLead("1234567890", { Company: "x" }),
		).rejects.toBeInstanceOf(ZohoError);
	});
});

describe("isWritableLeadField", () => {
	it("accepts an allow-listed field and refuses everything else", () => {
		expect(isWritableLeadField("Company")).toBe(true);
		expect(isWritableLeadField("Developer_s_Email")).toBe(true);
		expect(isWritableLeadField("Lead_Status")).toBe(false);
		expect(isWritableLeadField("Owner")).toBe(false);
		expect(isWritableLeadField("toString")).toBe(false);
	});
});
