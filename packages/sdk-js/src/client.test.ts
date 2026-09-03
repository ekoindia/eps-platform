import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import {
	EpsClient,
	EpsError,
	EpsHttpError,
	EpsIndeterminateError,
	MULTIPART_JSON_FIELD,
	generateClientRefId,
	signSecretKey,
	valueProblem,
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
		const err = await client
			.call("pan-lite", PAN_ARGS)
			.catch((e: unknown) => e);
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

// ── Shared fixtures for the three suites below (docs/sdk-golden-vector.md) ──

const ok = () => new Response(JSON.stringify({ status: 0 }), { status: 200 });
const http = (status: number) =>
	new Response(JSON.stringify({ status: 1 }), { status });
type FetchMock = ReturnType<typeof vi.fn>;
const bodyOf = (fetchMock: FetchMock, i = 0): Record<string, unknown> =>
	JSON.parse(fetchMock.mock.calls[i][1].body as string);
const urlOf = (fetchMock: FetchMock, i = 0): string =>
	String(fetchMock.mock.calls[i][0]);
const make = (
	fetchMock: unknown,
	opts: Partial<ConstructorParameters<typeof EpsClient>[0]> = {},
) =>
	new EpsClient({
		developerKey: "dev123",
		accessKey: "TEST_ACCESS_KEY_DO_NOT_USE",
		environment: "sandbox",
		fetch: fetchMock as typeof fetch,
		now: () => 1700000000000,
		retryBaseDelayMs: 0,
		...opts,
	});
/** pan-lite: POST, not financial. */
const PAN = {
	initiator_id: "9962981729",
	pan_number: "BNZAA2318J",
	name: "Rahul Sharma",
	dob: "1990-01-01",
};
/** dmt-initiate-transfer: POST, financial, client_ref_id required. */
const TRANSFER = {
	initiator_id: "9962981729",
	customer_id: "9123456789",
	recipient_id: "1",
	amount: 100,
	otp: "123456",
	otp_ref_id: "ref1",
};
const REF = /^[0-9a-z]{15}$/;

describe("client_ref_id", () => {
	it("generateClientRefId: 15 chars of [0-9a-z], stamp first, distinct tails", () => {
		const a = generateClientRefId(1700000000000);
		const b = generateClientRefId(1700000000000);
		expect(a).toMatch(REF);
		expect(a.slice(0, 8)).toBe((1700000000000).toString(36));
		expect(a).not.toBe(b);
	});

	it("is generated for a non-GET call that did not supply one", async () => {
		const f = vi.fn(async () => ok());
		await make(f).call("pan-lite", PAN);
		expect(bodyOf(f).client_ref_id).toMatch(REF);
	});

	it("keeps a supplied value untouched", async () => {
		const f = vi.fn(async () => ok());
		await make(f).call("pan-lite", { ...PAN, client_ref_id: "MY-REF_1" });
		expect(bodyOf(f).client_ref_id).toBe("MY-REF_1");
	});

	it("satisfies an endpoint that requires client_ref_id", async () => {
		const f = vi.fn(async () => ok());
		await make(f).call("dmt-initiate-transfer", TRANSFER);
		expect(bodyOf(f).client_ref_id).toMatch(REF);
	});

	it("is not added to a GET", async () => {
		const f = vi.fn(async () => ok());
		await make(f).call("bbps-get-operators", { initiator_id: "9962981729" });
		expect(urlOf(f)).not.toContain("client_ref_id");
	});

	it("is not added when the endpoint omits the param", async () => {
		const f = vi.fn(async () => ok());
		await make(f).call("get-refund-otp", {
			initiator_id: "9962981729",
			tid: "1",
		});
		expect(bodyOf(f)).not.toHaveProperty("client_ref_id");
	});

	it("differs between successive calls", async () => {
		const f = vi.fn(async () => ok());
		const client = make(f);
		await client.call("pan-lite", PAN);
		await client.call("pan-lite", PAN);
		expect(bodyOf(f, 0).client_ref_id).not.toBe(bodyOf(f, 1).client_ref_id);
	});

	it('treats "" as supplied, so it fails the client-ref format', async () => {
		const f = vi.fn(async () => ok());
		await expect(
			make(f).call("pan-lite", { ...PAN, client_ref_id: "" }),
		).rejects.toThrow(/client_ref_id \(expected format client-ref\)/);
		expect(f).not.toHaveBeenCalled();
	});
});

describe("retry and status check", () => {
	const GET = ["bbps-get-operators", { initiator_id: "9962981729" }] as const;
	const transportFailure = () => Promise.reject(new TypeError("fetch failed"));

	it("GET: retries a 500 and returns the eventual 2xx, re-signing each attempt", async () => {
		let t = 1700000000000;
		const f = vi
			.fn()
			.mockResolvedValueOnce(http(500))
			.mockResolvedValueOnce(ok());
		const client = make(f, { now: () => t++ });
		await expect(client.call(...GET)).resolves.toEqual({ status: 0 });
		expect(f).toHaveBeenCalledTimes(2);
		const ts = (i: number) =>
			(f.mock.calls[i][1].headers as Record<string, string>)[
				"secret-key-timestamp"
			];
		expect(ts(0)).not.toBe(ts(1));
	});

	it.each([
		["transport failure", transportFailure],
		[
			"timeout",
			() => Promise.reject(new DOMException("aborted", "TimeoutError")),
		],
		["HTTP 429", () => Promise.resolve(http(429))],
		["HTTP 503", () => Promise.resolve(http(503))],
	])(
		"GET: %s on every attempt → retries × retries, then throws that failure",
		async (_l, fail) => {
			const f = vi.fn(fail);
			await expect(make(f).call(...GET)).rejects.toThrow();
			expect(f).toHaveBeenCalledTimes(3);
		},
	);

	it("GET: does not retry a decisive 4xx", async () => {
		const f = vi.fn(async () => http(400));
		await expect(make(f).call(...GET)).rejects.toBeInstanceOf(EpsHttpError);
		expect(f).toHaveBeenCalledTimes(1);
	});

	it("GET: retries: 0 disables retrying", async () => {
		const f = vi.fn(async () => http(500));
		await expect(make(f, { retries: 0 }).call(...GET)).rejects.toThrow();
		expect(f).toHaveBeenCalledTimes(1);
	});

	it("POST: is never retried", async () => {
		const f = vi.fn(async () => http(500));
		await expect(make(f).call("pan-lite", PAN)).rejects.toBeInstanceOf(
			EpsHttpError,
		);
		expect(f).toHaveBeenCalledTimes(1);
	});

	it("financial POST + 5xx: inquires by client_ref_id and throws EpsIndeterminateError", async () => {
		const inquiry = { status: 0, data: { tx_status: "0", tid: "1" } };
		const f = vi
			.fn()
			.mockResolvedValueOnce(http(502))
			.mockResolvedValueOnce(new Response(JSON.stringify(inquiry)));
		const err = await make(f)
			.call("dmt-initiate-transfer", TRANSFER)
			.catch((e: unknown) => e);
		expect(err).toBeInstanceOf(EpsIndeterminateError);
		const e = err as EpsIndeterminateError;
		const ref = bodyOf(f, 0).client_ref_id as string;
		expect(e.clientRefId).toBe(ref);
		expect(e.slug).toBe("dmt-initiate-transfer");
		expect(e.status).toBe(502);
		expect(e.statusCheck).toEqual(inquiry);
		expect(e.statusCheckError).toBeNull();
		expect(e.cause).toBeInstanceOf(EpsHttpError);
		expect(e.message).toBe(
			`EPS request for "dmt-initiate-transfer" with client_ref_id "${ref}" has no confirmed outcome.`,
		);
		expect(f).toHaveBeenCalledTimes(2);
		expect(urlOf(f, 1)).toContain(
			`/tools/reference/transaction/client_ref_id%3A${ref}?initiator_id=9962981729`,
		);
		expect(f.mock.calls[1][1].method).toBe("GET");
	});

	it("financial POST + transport failure: same path, status null, supplied ref reused", async () => {
		const f = vi
			.fn()
			.mockImplementationOnce(transportFailure)
			.mockResolvedValueOnce(ok());
		const err = (await make(f)
			.call("dmt-initiate-transfer", { ...TRANSFER, client_ref_id: "MY-REF" })
			.catch((e: unknown) => e)) as EpsIndeterminateError;
		expect(err).toBeInstanceOf(EpsIndeterminateError);
		expect(err.clientRefId).toBe("MY-REF");
		expect(err.status).toBeNull();
		expect(err.cause).toBeInstanceOf(TypeError);
		expect(urlOf(f, 1)).toContain("client_ref_id%3AMY-REF");
	});

	it("a failing inquiry (its GET retries exhausted) lands on statusCheckError, never masking the cause", async () => {
		const f = vi
			.fn()
			.mockResolvedValueOnce(http(500))
			.mockImplementation(async () => http(503));
		const err = (await make(f)
			.call("dmt-initiate-transfer", TRANSFER)
			.catch((e: unknown) => e)) as EpsIndeterminateError;
		expect(err).toBeInstanceOf(EpsIndeterminateError);
		expect(err.statusCheck).toBeNull();
		expect((err.statusCheckError as EpsHttpError).status).toBe(503);
		expect((err.cause as EpsHttpError).status).toBe(500);
		expect(f).toHaveBeenCalledTimes(1 + 3);
	});

	it("financial POST + decisive 4xx: plain EpsHttpError, no inquiry", async () => {
		const f = vi.fn(async () => http(403));
		await expect(
			make(f).call("dmt-initiate-transfer", TRANSFER),
		).rejects.toBeInstanceOf(EpsHttpError);
		expect(f).toHaveBeenCalledTimes(1);
	});

	it("non-financial POST + 5xx: plain EpsHttpError, no inquiry", async () => {
		const f = vi.fn(async () => http(500));
		await expect(make(f).call("pan-lite", PAN)).rejects.toBeInstanceOf(
			EpsHttpError,
		);
		expect(f).toHaveBeenCalledTimes(1);
	});

	it("financial endpoint without a client_ref_id param (initiate-refund): no inquiry", async () => {
		const f = vi.fn(async () => http(500));
		await expect(
			make(f).call("initiate-refund", {
				initiator_id: "9962981729",
				tid: "1",
				otp: "1",
			}),
		).rejects.toBeInstanceOf(EpsHttpError);
		expect(f).toHaveBeenCalledTimes(1);
	});

	it("autoStatusCheck: false → no inquiry", async () => {
		const f = vi.fn(async () => http(500));
		await expect(
			make(f, { autoStatusCheck: false }).call(
				"dmt-initiate-transfer",
				TRANSFER,
			),
		).rejects.toBeInstanceOf(EpsHttpError);
		expect(f).toHaveBeenCalledTimes(1);
	});

	it("rejects bad retries / retryBaseDelayMs at construction", () => {
		for (const bad of [-1, 1.5, Number.NaN])
			expect(() => make(vi.fn(), { retries: bad })).toThrow(/Invalid retries/);
		for (const bad of [-1, Number.NaN])
			expect(() => make(vi.fn(), { retryBaseDelayMs: bad })).toThrow(
				/Invalid retryBaseDelayMs/,
			);
	});
});

describe("value validation", () => {
	it("rejects a bad format and sends nothing", async () => {
		const f = vi.fn(async () => ok());
		await expect(
			make(f).call("pan-lite", { ...PAN, dob: "01-01-1990" }),
		).rejects.toThrow(
			'Invalid param values for "pan-lite": dob (expected format date).',
		);
		expect(f).not.toHaveBeenCalled();
	});

	it("lists every offending param, in surface order", async () => {
		await expect(
			make(vi.fn()).call("pan-lite", {
				...PAN,
				pan_number: "bad",
				dob: "1990-1-1",
			}),
		).rejects.toThrow(
			'Invalid param values for "pan-lite": pan_number (expected format pan), dob (expected format date).',
		);
	});

	it("matches the whole string — a trailing newline is rejected", async () => {
		await expect(
			make(vi.fn()).call("pan-lite", { ...PAN, dob: "1990-01-01\n" }),
		).rejects.toThrow(/dob \(expected format date\)/);
	});

	it("maxLength counts UTF-8 bytes of the wire string", async () => {
		const f = vi.fn(async () => ok());
		await make(f).call("pan-lite", { ...PAN, client_ref_id: "x".repeat(20) });
		await expect(
			make(f).call("pan-lite", { ...PAN, client_ref_id: "x".repeat(21) }),
		).rejects.toThrow(/client_ref_id \(expected format client-ref\)/);
	});

	it("does not enforce a param with no constraints", async () => {
		const f = vi.fn(async () => ok());
		await make(f).call("pan-lite", { ...PAN, name: "anything at all \n" });
		expect(f).toHaveBeenCalledTimes(1);
	});

	it("rejects a value of the wrong type before value checks run", async () => {
		await expect(
			make(vi.fn()).call("pan-lite", { ...PAN, dob: true }),
		).rejects.toThrow(/Invalid param types/);
	});
});

describe("valueProblem", () => {
	const formats = new Map([["date", /^\d{4}-\d{2}-\d{2}$/]]);
	const check = (p: Partial<Parameters<typeof valueProblem>[0]>, v: unknown) =>
		valueProblem(
			{ name: "x", type: "string", required: false, ...p },
			v,
			formats,
		);

	it("enum compares wire strings", () => {
		expect(check({ enum: [1, 2] }, "1")).toBeNull();
		expect(check({ enum: [1, 2] }, 3)).toBe("not one of: 1, 2");
	});

	it("min/max are inclusive and numeric", () => {
		expect(check({ type: "number", min: 1, max: 5 }, "1")).toBeNull();
		expect(check({ type: "number", min: 1, max: 5 }, 5)).toBeNull();
		expect(check({ type: "number", min: 1 }, 0.5)).toBe("below min 1");
		expect(check({ type: "number", max: 5 }, "6")).toBe("above max 5");
	});

	it("maxLength is UTF-8 bytes, checked last", () => {
		expect(check({ maxLength: 3 }, "abc")).toBeNull();
		expect(check({ maxLength: 3 }, "é€")).toBe("longer than 3 bytes");
	});

	it("order: enum, then format, then range, then length", () => {
		expect(check({ enum: ["a"], format: "date" }, "b")).toBe("not one of: a");
		expect(check({ format: "date", maxLength: 1 }, "x")).toBe(
			"expected format date",
		);
	});

	it("skips non-scalar spec types", () => {
		expect(check({ type: "object", maxLength: 1 }, { a: 1 })).toBeNull();
	});
});
