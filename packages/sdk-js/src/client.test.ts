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
		await client.call("dmt-get-sender", { initiator_id: "9876543210" });
		const [url, init] = fetchMock.mock.calls[0];
		expect(String(url)).toContain("/customer/profile");
		const headers = init!.headers as Record<string, string>;
		expect(headers["developer_key"]).toBe("dev123");
		expect(headers["secret-key"]).toBe(GOLDEN);
		expect(headers["secret-key-timestamp"]).toBe("1700000000000");
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
