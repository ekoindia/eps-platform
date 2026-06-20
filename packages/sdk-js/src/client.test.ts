import { describe, expect, it, vi } from "vitest";

import { EpsClient, signSecretKey } from "./client.js";

// from docs/sdk-golden-vector.md
const GOLDEN = "u30ak/iOGwKCaspqCeiYng8fd98QDx7kF3DBBOadQHk=";

describe("signSecretKey", () => {
	it("reproduces the golden vector", () => {
		expect(signSecretKey("TEST_ACCESS_KEY_DO_NOT_USE", "1700000000000")).toBe(
			GOLDEN,
		);
	});
});

describe("EpsClient.call", () => {
	it("sends signed headers and the right method/url", async () => {
		const fetchMock = vi.fn(
			async (_url: RequestInfo | URL, _init?: RequestInit) =>
				new Response(JSON.stringify({ status: 0 }), { status: 200 }),
		);
		const client = new EpsClient({
			developerKey: "dev123",
			accessKey: "TEST_ACCESS_KEY_DO_NOT_USE",
			environment: "sandbox",
			fetch: fetchMock as unknown as typeof fetch,
			now: () => 1700000000000,
		});
		await client.call("dmt-get-sender", {
			customer_id: "9123456789",
			initiator_id: "9962981729",
			user_code: "20810200",
		});
		const [url, init] = fetchMock.mock.calls[0];
		expect(String(url)).toContain("/customer/payment/dmt-fino/sender");
		const headers = init!.headers as Record<string, string>;
		expect(headers["developer_key"]).toBe("dev123");
		expect(headers["secret-key"]).toBe(GOLDEN);
		expect(headers["secret-key-timestamp"]).toBe("1700000000000");
	});

	it("puts non-path params in the query string for GET (no body)", async () => {
		const fetchMock = vi.fn(
			async (_url: RequestInfo | URL, _init?: RequestInit) =>
				new Response(JSON.stringify({ status: 0 }), { status: 200 }),
		);
		const client = new EpsClient({
			developerKey: "dev123",
			accessKey: "TEST_ACCESS_KEY_DO_NOT_USE",
			environment: "sandbox",
			fetch: fetchMock as unknown as typeof fetch,
			now: () => 1700000000000,
		});
		await client.call("dmt-get-sender", {
			customer_id: "9123456789",
			initiator_id: "9962981729",
			user_code: "20810200",
		});
		const [url, init] = fetchMock.mock.calls[0];
		// path token filled, query params appended, no body sent
		expect(String(url)).toContain(
			"/customer/payment/dmt-fino/sender/9123456789",
		);
		expect(String(url)).toContain("initiator_id=9962981729");
		expect(String(url)).toContain("user_code=20810200");
		expect(String(url)).not.toContain("{customer_id}");
		expect(init!.body).toBeUndefined();
	});

	it("throws when a required param is missing or null", async () => {
		const fetchMock = vi.fn(
			async (_url: RequestInfo | URL, _init?: RequestInit) =>
				new Response(JSON.stringify({ status: 0 }), { status: 200 }),
		);
		const client = new EpsClient({
			developerKey: "dev123",
			accessKey: "TEST_ACCESS_KEY_DO_NOT_USE",
			environment: "sandbox",
			fetch: fetchMock as unknown as typeof fetch,
			now: () => 1700000000000,
		});
		// dmt-get-sender requires initiator_id, user_code, customer_id.
		await expect(
			client.call("dmt-get-sender", { initiator_id: "9962981729" }),
		).rejects.toThrow(/missing required params.*user_code.*customer_id/i);
		await expect(
			client.call("dmt-get-sender", {
				customer_id: "9123456789",
				initiator_id: "9962981729",
				user_code: null,
			}),
		).rejects.toThrow(/missing required params.*user_code/i);
		// nothing is signed or sent when validation fails
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("injects client-level initiatorId/userCode into every call", async () => {
		const fetchMock = vi.fn(
			async (_url: RequestInfo | URL, _init?: RequestInit) =>
				new Response(JSON.stringify({ status: 0 }), { status: 200 }),
		);
		const client = new EpsClient({
			developerKey: "dev123",
			accessKey: "TEST_ACCESS_KEY_DO_NOT_USE",
			environment: "sandbox",
			initiatorId: "9962981729",
			userCode: "20810200",
			fetch: fetchMock as unknown as typeof fetch,
			now: () => 1700000000000,
		});
		// No initiator_id / user_code passed per call — the client supplies them.
		await client.call("dmt-get-sender", { customer_id: "9123456789" });
		const [url] = fetchMock.mock.calls[0];
		expect(String(url)).toContain("initiator_id=9962981729");
		expect(String(url)).toContain("user_code=20810200");
	});

	it("lets a per-call param override the client-level default", async () => {
		const fetchMock = vi.fn(
			async (_url: RequestInfo | URL, _init?: RequestInit) =>
				new Response(JSON.stringify({ status: 0 }), { status: 200 }),
		);
		const client = new EpsClient({
			developerKey: "dev123",
			accessKey: "TEST_ACCESS_KEY_DO_NOT_USE",
			environment: "sandbox",
			initiatorId: "9962981729",
			userCode: "20810200",
			fetch: fetchMock as unknown as typeof fetch,
			now: () => 1700000000000,
		});
		await client.call("dmt-get-sender", {
			customer_id: "9123456789",
			initiator_id: "1111111111",
		});
		const [url] = fetchMock.mock.calls[0];
		expect(String(url)).toContain("initiator_id=1111111111");
		expect(String(url)).not.toContain("initiator_id=9962981729");
		expect(String(url)).toContain("user_code=20810200"); // default still used
	});

	it("treats an explicit null per-call value as clearing the default", async () => {
		const fetchMock = vi.fn(
			async (_url: RequestInfo | URL, _init?: RequestInit) =>
				new Response(JSON.stringify({ status: 0 }), { status: 200 }),
		);
		const client = new EpsClient({
			developerKey: "dev123",
			accessKey: "TEST_ACCESS_KEY_DO_NOT_USE",
			environment: "sandbox",
			initiatorId: "9962981729",
			userCode: "20810200",
			fetch: fetchMock as unknown as typeof fetch,
			now: () => 1700000000000,
		});
		// Explicit null overrides the default → required-param validation fails.
		await expect(
			client.call("dmt-get-sender", {
				customer_id: "9123456789",
				initiator_id: null,
			}),
		).rejects.toThrow(/missing required params.*initiator_id/i);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("accepts a numeric string for a number-typed param (lenient)", async () => {
		const fetchMock = vi.fn(
			async (_url: RequestInfo | URL, _init?: RequestInit) =>
				new Response(JSON.stringify({ status: 0 }), { status: 200 }),
		);
		const client = new EpsClient({
			developerKey: "dev123",
			accessKey: "TEST_ACCESS_KEY_DO_NOT_USE",
			environment: "sandbox",
			fetch: fetchMock as unknown as typeof fetch,
			now: () => 1700000000000,
		});
		// bbps-get-operators: category is an optional `number` param.
		await client.call("bbps-get-operators", {
			initiator_id: "9962981729",
			user_code: "20810200",
			category: "5",
		});
		const [url] = fetchMock.mock.calls[0];
		expect(String(url)).toContain("category=5");
	});

	it("throws on a type mismatch and signs/sends nothing", async () => {
		const fetchMock = vi.fn(
			async (_url: RequestInfo | URL, _init?: RequestInit) =>
				new Response(JSON.stringify({ status: 0 }), { status: 200 }),
		);
		const client = new EpsClient({
			developerKey: "dev123",
			accessKey: "TEST_ACCESS_KEY_DO_NOT_USE",
			environment: "sandbox",
			fetch: fetchMock as unknown as typeof fetch,
			now: () => 1700000000000,
		});
		await expect(
			client.call("bbps-get-operators", {
				initiator_id: "9962981729",
				user_code: "20810200",
				category: "abc",
			}),
		).rejects.toThrow(/invalid param types.*category \(expected number\)/i);
		await expect(
			client.call("bbps-get-operators", {
				initiator_id: "9962981729",
				user_code: "20810200",
				category: {},
			}),
		).rejects.toThrow(/invalid param types.*category/i);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("throws when constructed in a browser-like environment", () => {
		(globalThis as { window?: unknown }).window = {};
		expect(
			() =>
				new EpsClient({
					developerKey: "d",
					accessKey: "a",
					environment: "sandbox",
				}),
		).toThrow(/backend-only/i);
		delete (globalThis as { window?: unknown }).window;
	});
});
