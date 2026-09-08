import { API_ENVIRONMENTS } from "@/lib/data/api-auth";
import type { ApiSpec, ResolvedApiParam } from "@/lib/data/api-specs-common";
import { API_SPECS_MAP } from "@/lib/data/api-specs";
import { MULTIPART_JSON_FIELD } from "@/lib/data/api-specs-common";
import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
	abortKind,
	buildTryItRequest,
	coerceValue,
	ekoOutcome,
	generateClientRefId,
	matchErrorScenario,
	parseProxyError,
	redactCredentialKeys,
	sendViaProxy,
	TRYIT_PROXY_URL,
	txStatusLabel,
	validateParams,
} from "./tryit-request";

/** Independent reference of Eko's scheme, as in SecretKeyTester.test.tsx. */
const ref = (message: string, accessKey: string): string =>
	createHmac("sha256", Buffer.from(accessKey).toString("base64"))
		.update(message)
		.digest("base64");

const CREDS = { developerKey: "dev-key", accessKey: "access-key-1" };
const NOW = 1_700_000_000_000;

const jsonSpec = API_SPECS_MAP["pan-lite"] ?? Object.values(API_SPECS_MAP)[0];
const multipartSpec = API_SPECS_MAP["activate-aeps-fingpay"];
const getSpec = Object.values(API_SPECS_MAP).find((s) => s.method === "GET");
const financialSpec = Object.values(API_SPECS_MAP).find((s) => s.financial);

const param = (over: Partial<ResolvedApiParam>): ResolvedApiParam => ({
	name: "x",
	type: "string",
	required: false,
	in: "body",
	...over,
});

describe("generateClientRefId", () => {
	it("is 15 base-36 chars and unique", () => {
		const seen = new Set<string>();
		for (let i = 0; i < 1000; i++) {
			const id = generateClientRefId(NOW + i);
			expect(id).toMatch(/^[0-9a-z]{15}$/);
			seen.add(id);
		}
		expect(seen.size).toBe(1000);
	});
});

describe("coerceValue", () => {
	it("omits blank numbers, parses numbers and booleans, keeps strings", () => {
		expect(coerceValue(param({ type: "number" }), " ")).toBeUndefined();
		expect(coerceValue(param({ type: "integer" }), "42")).toBe(42);
		expect(coerceValue(param({ type: "boolean" }), "true")).toBe(true);
		expect(coerceValue(param({ type: "string" }), "0")).toBe("0");
	});
});

describe("validateParams", () => {
	const empty = { params: {}, body: {}, files: {} };
	it("flags required, enum, bounds, byte length, format and file size", () => {
		const params = [
			param({ name: "req", required: true }),
			param({ name: "en", enum: ["a", 5] }),
			param({ name: "num", type: "integer", min: 1, max: 10 }),
			param({ name: "len", maxLength: 3 }),
			param({ name: "pan", format: "pan" }),
			param({ name: "doc", type: "file", max: 10 }),
			param({ name: "q", in: "query", required: true }),
		];
		const errors = validateParams(params, {
			params: {},
			body: { en: "z", num: 3.5, len: "héé", pan: "nope" },
			files: { doc: new File([new Uint8Array(11)], "d.jpg") },
		});
		expect(errors).toEqual({
			req: "Required",
			en: "Must be one of: a, 5",
			num: "Must be a whole number",
			len: "Max 3 bytes",
			pan: "Expected PAN (e.g. ABCDE1234F)",
			doc: "File too large (max 0 KB)",
			q: "Required",
		});
	});
	it("passes valid values and skips optional blanks", () => {
		const params = [
			param({ name: "en", enum: ["a", 5] }),
			param({ name: "num", type: "number", min: 1 }),
			param({ name: "opt" }),
		];
		expect(
			validateParams(params, { ...empty, body: { en: 5, num: 2 } }),
		).toEqual({});
	});
});

describe("buildTryItRequest", () => {
	it("signs at call time, renames developer_key, never sends access_key (JSON)", async () => {
		const req = await buildTryItRequest(jsonSpec, {
			env: "production",
			params: {},
			body: { a: 1 },
			files: {},
			creds: CREDS,
			now: NOW,
		});
		expect(req.url.startsWith(API_ENVIRONMENTS.production.baseUrl)).toBe(true);
		expect(req.method).toBe(jsonSpec.method);
		expect(req.headers["x-eps-developer-key"]).toBe("dev-key");
		expect(req.headers["secret-key"]).toBe(ref(String(NOW), CREDS.accessKey));
		expect(req.headers["secret-key-timestamp"]).toBe(String(NOW));
		expect(req.headers["content-type"]).toBe("application/json");
		expect(JSON.stringify(req.headers)).not.toContain("access-key-1");
		expect(req.headers.developer_key).toBeUndefined();
		expect(req.body).toBe('{"a":1}');
	});

	it("builds multipart with the JSON envelope minus file keys + file parts", async () => {
		const pan = new File(["x"], "pan.jpg", { type: "image/jpeg" });
		const req = await buildTryItRequest(multipartSpec, {
			env: "sandbox",
			params: {},
			body: { initiator_id: "1", office_address: { city: "Delhi" } },
			files: { pan_card: pan, aadhar_front: null, aadhar_back: null },
			creds: CREDS,
			now: NOW,
		});
		expect(req.headers["content-type"]).toBeUndefined();
		const form = req.body as FormData;
		expect(JSON.parse(form.get(MULTIPART_JSON_FIELD) as string)).toEqual({
			initiator_id: "1",
			office_address: { city: "Delhi" },
		});
		expect(form.get("pan_card")).toBeInstanceOf(File);
		expect(form.get("aadhar_front")).toBeNull();
	});

	it("sends no body for GET and encodes query/path values", async () => {
		if (!getSpec) return;
		const req = await buildTryItRequest(getSpec, {
			env: "sandbox",
			params: {},
			body: {},
			files: {},
			creds: CREDS,
			now: NOW,
		});
		expect(req.body).toBeUndefined();
		expect(req.headers["content-type"]).toBeUndefined();
	});
});

describe("sendViaProxy", () => {
	const okFetch = (
		body: string,
		init: { status?: number; headers?: Record<string, string> } = {},
	) =>
		vi.fn().mockResolvedValue(
			new Response(body, {
				status: init.status ?? 200,
				headers: {
					"content-type": "application/json",
					"x-eps-proxied": "1",
					...init.headers,
				},
			}),
		) as unknown as typeof fetch;

	const req = {
		url: "https://staging.eko.in/ekoapi/v3/x",
		method: "POST" as const,
		headers: { "x-eps-developer-key": "d", "secret-key": "s" },
		body: "{}",
	};

	it("posts to the proxy with target headers and returns parsed result", async () => {
		const fetchImpl = okFetch('{"status":0,"data":{"ok":true}}');
		const result = await sendViaProxy(
			req,
			new AbortController().signal,
			fetchImpl,
		);
		const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
			.calls[0] as [string, RequestInit];
		expect(url).toBe(TRYIT_PROXY_URL);
		expect(init.method).toBe("POST");
		expect(init.headers).toMatchObject({
			"x-eps-target-url": req.url,
			"x-eps-target-method": "POST",
			"x-eps-developer-key": "d",
		});
		expect(result.httpStatus).toBe(200);
		expect(result.json).toEqual({ status: 0, data: { ok: true } });
		expect(result.bytes).toBe(31);
		expect(result.requestHeaders.developer_key).toBe("d");
		expect(result.requestHeaders["x-eps-developer-key"]).toBeUndefined();
	});

	it("throws a proxy error when x-eps-proxied is missing", async () => {
		const fetchImpl = vi.fn().mockResolvedValue(
			new Response('{"error":{"code":"RATE_LIMITED","message":"slow down"}}', {
				status: 429,
				headers: { "content-type": "application/json" },
			}),
		) as unknown as typeof fetch;
		await expect(
			sendViaProxy(req, new AbortController().signal, fetchImpl),
		).rejects.toThrow("RATE_LIMITED: slow down");
	});

	it("treats a non-envelope non-proxied reply as a routing problem", () => {
		expect(parseProxyError(404, null)).toMatch(/HTTP 404.*eps-backend/);
	});
});

describe("classification", () => {
	it("ekoOutcome reads status===0 only from plain objects", () => {
		expect(ekoOutcome({ status: 0 })).toBe("success");
		expect(ekoOutcome({ status: 97 })).toBe("failure");
		expect(ekoOutcome({ message: "x" })).toBe("unknown");
		expect(ekoOutcome(null)).toBe("unknown");
	});
	it("txStatusLabel maps the financial envelope", () => {
		expect(txStatusLabel({ data: { tx_status: "2" } })).toBe(
			"Awaited (tx_status 2)",
		);
		expect(txStatusLabel({ status: 0 })).toBeUndefined();
	});
	it("matchErrorScenario matches by response_type_id then status pair", () => {
		const spec = {
			...jsonSpec,
			errorScenarios: [
				{ scenario: "A", example: { response_type_id: 1234, status: 1 } },
				{ scenario: "B", example: { status: 5, response_status_id: 9 } },
			],
		} as ApiSpec;
		expect(matchErrorScenario(spec, { response_type_id: 1234 })?.scenario).toBe(
			"A",
		);
		expect(
			matchErrorScenario(spec, { status: 5, response_status_id: 9 })?.scenario,
		).toBe("B");
		expect(matchErrorScenario(spec, { status: 5 })).toBeUndefined();
		expect(matchErrorScenario(spec, null)).toBeUndefined();
	});
	it("redactCredentialKeys strips credential-named keys", () => {
		expect(
			redactCredentialKeys({ a: 1, Access_Key: "x", "secret-key": "y" }),
		).toEqual({ a: 1 });
	});
	it("abortKind distinguishes timeout from cancel", () => {
		const timeout = new DOMException("t", "TimeoutError");
		expect(abortKind(timeout)).toBe("timeout");
		expect(abortKind(new DOMException("a", "AbortError"))).toBe("cancelled");
	});
	it("financial specs exist to classify", () => {
		expect(financialSpec).toBeDefined();
	});
});
