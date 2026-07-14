import { describe, it, expect, vi } from "vitest";
import type { Mock } from "vitest";
import { createEkoClient } from "./eko";

const ekoCfg = {
	scheme: "https",
	host: "sb.local",
	port: 8080,
	path: "/v1",
	developerKey: "devkey",
	initiatorId: "1234567891",
	userCode: "99029899",
	defaultOrgId: 1,
	logLevel: "off" as const,
};

function mockFetch(status: number, body: unknown) {
	return vi.fn(
		async () => new Response(JSON.stringify(body), { status }),
	) as unknown as typeof fetch;
}

describe("EkoClient.sendOtp", () => {
	it("posts interaction_type_id 515 with developer_key + form body", async () => {
		const f = mockFetch(200, { response_status_id: 0 });
		const eko = createEkoClient(ekoCfg, f);
		const res = await eko.sendOtp({ mobile: "9990000001" });
		expect(res.ok).toBe(true);

		const [url, init] = (f as unknown as Mock).mock.calls[0];
		expect(url).toBe("https://sb.local:8080/v1");
		expect(init.method).toBe("POST");
		expect(init.headers["developer_key"]).toBe("devkey");
		expect(init.headers["Content-Type"]).toBe(
			"application/x-www-form-urlencoded",
		);
		const body = new URLSearchParams(init.body as string);
		expect(body.get("interaction_type_id")).toBe("515");
		expect(body.get("mobile")).toBe("9990000001");
		expect(body.get("initiator_id")).toBe("1234567891");
		expect(body.get("user_code")).toBe("99029899");
		expect(body.get("org_id")).toBe("1");
		// No X-Real-IP header when the caller did not supply one (omit, not empty).
		expect("X-Real-IP" in init.headers).toBe(false);
	});

	it("forwards X-Real-IP when provided", async () => {
		const f = mockFetch(200, { response_status_id: 0 });
		const eko = createEkoClient(ekoCfg, f);
		await eko.sendOtp({ mobile: "9990000001", xRealIp: "1.2.3.4" });
		const init = (f as unknown as Mock).mock.calls[0][1];
		expect(init.headers["X-Real-IP"]).toBe("1.2.3.4");
	});
});

describe("EkoClient.verifyOtp", () => {
	it("returns ok on response_status_id 0 with id 518", async () => {
		const f = mockFetch(200, { response_status_id: 0 });
		const eko = createEkoClient(ekoCfg, f);
		const res = await eko.verifyOtp({ mobile: "9990000001", otp: "123456" });
		expect(res.ok).toBe(true);
		const body = new URLSearchParams(
			(f as unknown as Mock).mock.calls[0][1].body,
		);
		expect(body.get("interaction_type_id")).toBe("518");
		expect(body.get("otp")).toBe("123456");
		expect(body.get("verification_type")).toBe("2");
	});

	it("forwards X-Real-IP when provided", async () => {
		const f = mockFetch(200, { response_status_id: 0 });
		const eko = createEkoClient(ekoCfg, f);
		await eko.verifyOtp({ mobile: "x", otp: "y", xRealIp: "9.9.9.9" });
		const init = (f as unknown as Mock).mock.calls[0][1];
		expect(init.headers["X-Real-IP"]).toBe("9.9.9.9");
	});

	it("returns not-ok on non-zero status id", async () => {
		const f = mockFetch(200, { response_status_id: 1 });
		const eko = createEkoClient(ekoCfg, f);
		const res = await eko.verifyOtp({ mobile: "x", otp: "y" });
		expect(res.ok).toBe(false);
	});
});

describe("EkoClient upstream errors", () => {
	it("throws on non-2xx HTTP status", async () => {
		const f = mockFetch(500, { whatever: true });
		const eko = createEkoClient(ekoCfg, f);
		await expect(eko.sendOtp({ mobile: "x" })).rejects.toThrow();
	});
});

describe("EkoClient.getProfile", () => {
	it("maps 369 success to found with mapped fields", async () => {
		const f = mockFetch(200, {
			response_type_id: 369,
			data: {
				user_detail: {
					name: "Dev",
					email: "d@e.in",
					mobile: "9990000001",
					code: 42,
					user_type: "merchant",
					eko_user_id: "EKO123",
					role_list: [1, 2],
					org_id: 1,
					onboarding: 0,
					crm_contact_id: "ZCRM_9",
				},
			},
		});
		const eko = createEkoClient(ekoCfg, f);
		const r = await eko.getProfile({ mobile: "9990000001" });
		expect(r.kind).toBe("found");
		if (r.kind === "found") {
			expect(r.profile.zohoId).toBe("ZCRM_9");
			expect(r.profile.ekoUserId).toBe("EKO123");
			expect(r.profile.onboarding).toBe(0);
			expect(r.profile.roleList).toEqual(["1", "2"]);
		}
	});

	it("maps not-found codes (319/1200/1867)", async () => {
		for (const code of [319, 1200, 1867]) {
			const f = mockFetch(200, { response_type_id: code });
			const eko = createEkoClient(ekoCfg, f);
			const r = await eko.getProfile({ mobile: "x" });
			expect(r.kind).toBe("not_found");
		}
	});

	it("maps 2123 to inactive", async () => {
		const f = mockFetch(200, { response_type_id: 2123 });
		const eko = createEkoClient(ekoCfg, f);
		const r = await eko.getProfile({ mobile: "x" });
		expect(r.kind).toBe("inactive");
	});

	it("falls back to response_code when response_type_id is absent", async () => {
		const f = mockFetch(200, { response_code: 2123 });
		const eko = createEkoClient(ekoCfg, f);
		const r = await eko.getProfile({ mobile: "x" });
		expect(r.kind).toBe("inactive");
	});

	it("forwards X-Real-IP when provided", async () => {
		const f = mockFetch(200, { response_type_id: 319 });
		const eko = createEkoClient(ekoCfg, f);
		await eko.getProfile({ mobile: "x", xRealIp: "5.6.7.8" });
		const init = (f as unknown as Mock).mock.calls[0][1];
		expect(init.headers["X-Real-IP"]).toBe("5.6.7.8");
	});
});
