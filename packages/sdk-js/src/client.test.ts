import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import {
	EpsClient,
	EpsError,
	EpsHttpError,
	MULTIPART_JSON_FIELD,
	signSecretKey,
} from "./client.js";

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
		// dmt-get-sender requires initiator_id and customer_id (user_code is optional).
		await expect(
			client.call("dmt-get-sender", { user_code: "20810200" }),
		).rejects.toThrow(/missing required params.*initiator_id.*customer_id/i);
		await expect(
			client.call("dmt-get-sender", {
				initiator_id: "9962981729",
				customer_id: null,
			}),
		).rejects.toThrow(/missing required params.*customer_id/i);
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

	it("sends FormData (no content-type header) for a file-upload endpoint", async () => {
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
		const address = {
			line: "Shop 5",
			city: "Patna",
			state: "Bihar",
			pincode: "800001",
		};
		// aadhar_front exercises the path-string branch (read from disk) using
		// this test file itself as a real, readable file.
		const selfPath = fileURLToPath(import.meta.url);
		await client.call("activate-aeps-fingpay", {
			initiator_id: "9962981729",
			user_code: "20810200",
			modelname: "Morpho 1300E3",
			devicenumber: "SN1234567890",
			account: "38759149196",
			ifsc: "SBIN0007515",
			shop_type: 4215,
			office_address: address,
			address_as_per_proof: address,
			pan_card: new Blob(["pan"], { type: "image/jpeg" }),
			aadhar: "123456789012",
			aadhar_front: selfPath,
			aadhar_back: new Blob(["back"]),
			latlong: "28.6139,77.2090",
		});
		const [url, init] = fetchMock.mock.calls[0];
		expect(String(url)).toContain(
			"/admin/network/agent/20810200/aeps-fingpay/activate",
		);
		const headers = init!.headers as Record<string, string>;
		expect(headers["content-type"]).toBeUndefined();
		expect(headers["secret-key"]).toBe(GOLDEN); // still signed
		const body = init!.body as FormData;
		expect(body).toBeInstanceOf(FormData);
		// Every non-file value rides in ONE `form-data` JSON field, never a form
		// field of its own; objects stay nested rather than being stringified.
		expect(body.get("modelname")).toBeNull();
		expect(body.get("office_address")).toBeNull();
		const payload = JSON.parse(String(body.get("form-data")));
		expect(payload).toMatchObject({
			modelname: "Morpho 1300E3",
			shop_type: 4215,
			office_address: address,
			latlong: "28.6139,77.2090",
		});
		expect(payload).not.toHaveProperty("pan_card");
		expect(payload).not.toHaveProperty("user_code"); // filled the path
		// Blob without a name falls back to the param name; a path string keeps
		// its basename.
		expect((body.get("pan_card") as File).name).toBe("pan_card");
		expect((body.get("aadhar_front") as File).name).toBe("client.test.ts");
		expect(body.get("aadhar_back") as File).toBeInstanceOf(Blob);
	});

	it("omits a null param from the envelope but keeps nulls nested inside a value", async () => {
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
		await client.call("activate-aeps-fingpay", {
			initiator_id: "9962981729",
			user_code: "20810200",
			modelname: "Morpho 1300E3",
			devicenumber: "SN1234567890",
			account: "38759149196",
			ifsc: "SBIN0007515",
			shop_type: 4215,
			// Not a declared param, so it exercises the top-level-null rule without
			// inventing an optional field on a spec that has none.
			extra_note: null,
			office_address: { line: "Shop 5", state: null },
			address_as_per_proof: {},
			pan_card: new Blob(["pan"]),
			aadhar: "123456789012",
			aadhar_front: new Blob(["a"]),
			aadhar_back: new Blob(["b"]),
			latlong: "28.6139,77.2090",
		});
		const body = fetchMock.mock.calls[0][1]!.body as FormData;
		const payload = JSON.parse(String(body.get("form-data")));
		// A null param has no form encoding, so it is dropped entirely...
		expect(payload).not.toHaveProperty("extra_note");
		// ...but a null INSIDE an object value is real data JSON preserves.
		expect(payload.office_address).toEqual({ line: "Shop 5", state: null });
	});

	it("rejects a non-file value for a file param and sends nothing", async () => {
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
			client.call("activate-aeps-fingpay", {
				initiator_id: "9962981729",
				user_code: "20810200",
				modelname: "Morpho 1300E3",
				devicenumber: "SN1234567890",
				account: "38759149196",
				ifsc: "SBIN0007515",
				shop_type: 4215,
				office_address: {},
				address_as_per_proof: {},
				pan_card: 123,
				aadhar: "123456789012",
				aadhar_front: new Blob(["a"]),
				aadhar_back: new Blob(["b"]),
				latlong: "28.6139,77.2090",
			}),
		).rejects.toThrow(/invalid param types.*pan_card \(expected file\)/i);
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

// The response/error contract shared by all five SDKs — docs/sdk-golden-vector.md.
describe("EpsClient response contract", () => {
	const clientWith = (
		fetchMock: unknown,
		opts: Partial<ConstructorParameters<typeof EpsClient>[0]> = {},
	) =>
		new EpsClient({
			developerKey: "dev123",
			accessKey: "TEST_ACCESS_KEY_DO_NOT_USE",
			environment: "sandbox",
			fetch: fetchMock as typeof fetch,
			now: () => 1700000000000,
			...opts,
		});

	const PAN_ARGS = {
		initiator_id: "9962981729",
		pan_number: "BNZAA2318J",
		name: "Rahul Sharma",
		dob: "1990-01-01",
	};

	it("throws EpsHttpError on a non-2xx response, keeping the envelope", async () => {
		const body = { status: 403, message: "Forbidden" };
		const client = clientWith(
			vi.fn(async () => new Response(JSON.stringify(body), { status: 403 })),
		);
		const err = await client.call("pan-lite", PAN_ARGS).catch((e: unknown) => e);
		expect(err).toBeInstanceOf(EpsHttpError);
		const httpErr = err as EpsHttpError;
		expect(httpErr.status).toBe(403);
		expect(httpErr.url).toContain("/tools/kyc/pan-lite");
		expect(httpErr.body).toEqual(body);
		expect(httpErr.raw).toBe(JSON.stringify(body));
		expect(httpErr.message).toBe(
			`EPS request to ${httpErr.url} failed with HTTP 403.`,
		);
	});

	it("keeps a non-JSON error body on raw with a null body", async () => {
		const client = clientWith(
			vi.fn(async () => new Response("<html>502</html>", { status: 502 })),
		);
		const err = (await client
			.call("pan-lite", PAN_ARGS)
			.catch((e: unknown) => e)) as EpsHttpError;
		expect(err).toBeInstanceOf(EpsHttpError);
		expect(err.body).toBeNull();
		expect(err.raw).toBe("<html>502</html>");
	});

	it("throws EpsError when a 2xx body is not JSON — never returns {}", async () => {
		const client = clientWith(
			vi.fn(async () => new Response("not json", { status: 200 })),
		);
		await expect(client.call("pan-lite", PAN_ARGS)).rejects.toThrow(
			/was not valid JSON/,
		);
	});

	it("reports validation failures as EpsError", async () => {
		const client = clientWith(vi.fn());
		await expect(client.call("pan-lite", {})).rejects.toBeInstanceOf(EpsError);
	});

	it("exports MULTIPART_JSON_FIELD", () => {
		expect(MULTIPART_JSON_FIELD).toBe("form-data");
	});
});

describe("EpsClient timeout", () => {
	const build = (fetchMock: unknown, timeoutMs?: number) =>
		new EpsClient({
			developerKey: "dev123",
			accessKey: "TEST_ACCESS_KEY_DO_NOT_USE",
			environment: "sandbox",
			fetch: fetchMock as typeof fetch,
			now: () => 1700000000000,
			...(timeoutMs === undefined ? {} : { timeoutMs }),
		});

	const PAN_ARGS = {
		initiator_id: "9962981729",
		pan_number: "BNZAA2318J",
		name: "Rahul Sharma",
		dob: "1990-01-01",
	};

	it("passes an abort signal to fetch, defaulting to 30s", async () => {
		const spy = vi.spyOn(AbortSignal, "timeout");
		const fetchMock = vi.fn(
			async (_url: RequestInfo | URL, _init?: RequestInit) =>
				new Response(JSON.stringify({ status: 0 }), { status: 200 }),
		);
		await build(fetchMock).call("pan-lite", PAN_ARGS);
		expect(spy).toHaveBeenCalledWith(30_000);
		expect(fetchMock.mock.calls[0][1]!.signal).toBeInstanceOf(AbortSignal);
		spy.mockRestore();
	});

	it("honours an explicit timeoutMs", async () => {
		const spy = vi.spyOn(AbortSignal, "timeout");
		await build(
			vi.fn(async () => new Response(JSON.stringify({ status: 0 }))),
			1234,
		).call("pan-lite", PAN_ARGS);
		expect(spy).toHaveBeenCalledWith(1234);
		spy.mockRestore();
	});

	// The real thing, not just plumbing: a transport that never settles must be
	// aborted rather than hanging the caller forever.
	it("aborts a request that never settles", async () => {
		const fetchMock = vi.fn(
			(_url: RequestInfo | URL, init?: RequestInit) =>
				new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener("abort", () =>
						reject(init.signal!.reason as Error),
					);
				}),
		);
		await expect(
			build(fetchMock, 20).call("pan-lite", PAN_ARGS),
		).rejects.toThrow(/abort/i);
	});

	it("rejects a non-positive or non-finite timeoutMs at construction", () => {
		for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY])
			expect(() => build(vi.fn(), bad)).toThrow(/Invalid timeoutMs/);
	});
});
