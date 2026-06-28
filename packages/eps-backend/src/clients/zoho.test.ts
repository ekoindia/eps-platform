import { describe, it, expect, vi } from "vitest";
import type { Mock } from "vitest";
import { createZohoClient } from "./zoho";

describe("ZohoClient", () => {
	it("disabled → false, no fetch", async () => {
		const f = vi.fn() as unknown as typeof fetch;
		const z = createZohoClient({ enabled: false }, f);
		expect(await z.findLead("999")).toBe(false);
		expect((f as unknown as Mock).mock.calls.length).toBe(0);
	});

	it("enabled + lead found → true", async () => {
		const f = vi.fn(
			async () =>
				new Response(JSON.stringify({ data: [{ id: "1" }] }), { status: 200 }),
		) as unknown as typeof fetch;
		const z = createZohoClient(
			{ enabled: true, baseUrl: "https://zoho.test", accessToken: "tok" },
			f,
		);
		expect(await z.findLead("999")).toBe(true);
	});

	it("enabled + no data → false", async () => {
		const f = vi.fn(
			async () => new Response(JSON.stringify({ data: [] }), { status: 200 }),
		) as unknown as typeof fetch;
		const z = createZohoClient(
			{ enabled: true, baseUrl: "https://zoho.test", accessToken: "tok" },
			f,
		);
		expect(await z.findLead("999")).toBe(false);
	});
});
