import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EpsClient, EpsIndeterminateError, signSecretKey } from "./client.js";
import { Masker } from "./debug.js";

// Fixtures from "Debug mode conformance" in docs/sdk-golden-vector.md.
const DEV = "abcd1234wxyz";
const ACCESS = "TEST_ACCESS_KEY_DO_NOT_USE";
const NOW = 1700000000000;
const SECRET = signSecretKey(ACCESS, String(NOW));
const SECRETS = [
	DEV,
	SECRET,
	"123456789012",
	"9876543210",
	"000111222333",
	"654321",
	"k@x.in",
	"john@example.com",
	"Kumar",
	"KUMAR_123456789012",
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- events are free-form JSON
type Event = Record<string, any>;
type Reply = { status?: number; body: string } | Error;

/** A fetch that plays `replies` in order (the last one repeats). */
const fetchOf = (...replies: Reply[]) => {
	let i = 0;
	return vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => {
		const reply = replies[Math.min(i++, replies.length - 1)];
		if (reply instanceof Error) throw reply;
		return new Response(reply.body, { status: reply.status ?? 200 });
	});
};

const ok = (extra: object = {}): Reply => ({
	body: JSON.stringify({ status: 0, response_status_id: 0, ...extra }),
});

const make = (fetchFn: ReturnType<typeof fetchOf>, extra: object = {}) => {
	const events: Event[] = [];
	const client = new EpsClient({
		developerKey: DEV,
		accessKey: ACCESS,
		environment: "sandbox",
		initiatorId: "9962981729",
		fetch: fetchFn as unknown as typeof fetch,
		now: () => NOW,
		retryBaseDelayMs: 0,
		debug: (event) => events.push(event),
		...extra,
	});
	return { client, events };
};

const ofType = (events: Event[], type: string) =>
	events.filter((e) => e.event === type);

const expectNoSecrets = (events: Event[]) => {
	const all = JSON.stringify(events);
	for (const secret of SECRETS) expect(all, secret).not.toContain(secret);
};

const PAN_LITE = {
	pan_number: "ABCDE1234F",
	name: "Kumar",
	dob: "1990-01-01",
};

let savedEnv: string | undefined;
beforeEach(() => {
	savedEnv = process.env["EPS_SDK_DEBUG"];
	delete process.env["EPS_SDK_DEBUG"];
});
afterEach(() => {
	if (savedEnv === undefined) delete process.env["EPS_SDK_DEBUG"];
	else process.env["EPS_SDK_DEBUG"] = savedEnv;
	vi.restoreAllMocks();
});

describe("debug switch", () => {
	const stderrLines = () => {
		const lines: string[] = [];
		vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
			lines.push(String(chunk));
			return true;
		});
		return lines;
	};
	const plain = (extra: object = {}) =>
		new EpsClient({
			developerKey: DEV,
			accessKey: ACCESS,
			environment: "sandbox",
			initiatorId: "9962981729",
			fetch: fetchOf(ok()) as unknown as typeof fetch,
			now: () => NOW,
			...extra,
		});

	it("is off by default: nothing written to stderr", async () => {
		const lines = stderrLines();
		await plain().call("bbps-operator-code-circle", {
			customer_mobile: "9876543210",
		});
		expect(lines).toEqual([]);
	});

	it("EPS_SDK_DEBUG=1 writes one JSON object per line to stderr", async () => {
		process.env["EPS_SDK_DEBUG"] = " TRUE ";
		const lines = stderrLines();
		await plain().call("bbps-operator-code-circle", {
			customer_mobile: "9876543210",
		});
		expect(lines.length).toBe(3); // init, request, response
		for (const line of lines) {
			expect(line.endsWith("\n")).toBe(true);
			expect(line.startsWith('{"logger":"eps-sdk"')).toBe(true);
			JSON.parse(line);
		}
		const init = JSON.parse(lines[0]);
		expect(init).toMatchObject({
			event: "init",
			source: "env",
			developer_key: "****wxyz",
			env: "sandbox",
			sdk: "js",
			timeout_ms: 30000,
			retries: 2,
			auto_status_check: true,
		});
		expect(init.sdk_version).toMatch(/^\d+\.\d+\.\d+/);
		expect(lines.join("")).not.toContain("9876543210");
	});

	it("an explicit debug: false beats the env var", async () => {
		process.env["EPS_SDK_DEBUG"] = "1";
		const lines = stderrLines();
		await plain({ debug: false }).call("bbps-operator-code-circle", {
			customer_mobile: "9876543210",
		});
		expect(lines).toEqual([]);
	});

	it("rejects a debug option that is neither boolean nor function", () => {
		expect(() => plain({ debug: "yes" })).toThrow(/Invalid debug/);
	});
});

describe("debug events", () => {
	it("masks the GET URL, headers and keeps the documented key order", async () => {
		const { client, events } = make(fetchOf(ok()));
		await client.call("bbps-operator-code-circle", {
			customer_mobile: "9876543210",
		});
		expect(events.map((e) => e.event)).toEqual(["init", "request", "response"]);
		const [, request, response] = events;
		expect(Object.keys(request).slice(0, 9)).toEqual([
			"logger",
			"ts",
			"event",
			"sdk",
			"sdk_version",
			"surface",
			"env",
			"call_id",
			"slug",
		]);
		expect(request.call_id).toMatch(/^[0-9a-f]{8}$/);
		expect(response.call_id).toBe(request.call_id);
		expect(request.url).toBe(
			"https://staging.eko.in/ekoapi/v3/customer/payment/bbps/recharge/****3210/operator?initiator_id=****1729",
		);
		expect(request.headers).toEqual({
			developer_key: "****wxyz",
			"secret-key": "****",
			"secret-key-timestamp": String(NOW),
			"content-type": "application/json",
		});
		expect(request.body).toBeNull();
		expect(response).toMatchObject({
			status: 200,
			body: { status: 0, response_status_id: 0 },
		});
		expect(typeof response.ms).toBe("number");
		expectNoSecrets(events);
	});

	it("masks a JSON body and response by key class (fail-closed)", async () => {
		const response = {
			message: "sent to k@x.in, ref 9876543210",
			data: {
				tid: "2611230001",
				name: "Kumar",
				email: "k@x.in",
				dob: "1990-01-01",
				photo: "A".repeat(5000),
				reference_id: "123456789012",
				"john@example.com": "x",
				"123456789012": "y",
			},
			otp_code: { reference_id: "r1" },
			foo: [{ tid: "t1" }],
		};
		const { client, events } = make(fetchOf(ok(response)));
		await client.call("pan-lite", {
			...PAN_LITE,
			AADHAR: "123456789012",
			otp_code: "654321",
			otp: "7777", // 4 chars: asserted by field (a short known value can match inside a longer number)
			foo_bar: "x",
			entries: [
				{
					reference_id: "r1",
					bank_account: "000111222333",
					ifsc: "SBIN0000001",
				},
			],
		});
		const request = ofType(events, "request")[0];
		expect(request.body).toMatchObject({
			pan_number: "****234F",
			name: "****",
			dob: "****",
			AADHAR: "****9012",
			otp_code: "****",
			otp: "****",
			foo_bar: "****",
			initiator_id: "****1729",
			entries: [
				{ reference_id: "r1", bank_account: "****2333", ifsc: "SBIN0000001" },
			],
		});
		expect(request.body.client_ref_id).toMatch(/^[0-9a-z]{15}$/); // generated, safe
		const body = ofType(events, "response")[0].body;
		expect(body.message).toBe("sent to ****@****, ref ****3210");
		expect(body.data).toEqual({
			tid: "2611230001",
			name: "****",
			email: "****",
			dob: "****",
			photo: "****",
			reference_id: "****", // a request secret echoed under a safe key
			"#1": "****",
			"#2": "****",
		});
		expect(body.otp_code).toBe("****");
		expect(body.foo).toBe("****");
		expectNoSecrets(events);
	});

	it("masks a client_ref_id that fails the client-ref format, in the URL and its echo", async () => {
		const { client, events } = make(
			fetchOf(ok({ data: { client_ref_id: "KUMAR 123456789012" } })),
		);
		await client.call("bbps-fetch-bill", {
			phone_operator_code: "1",
			utility_acc_no: "000111222333",
			confirmation_mobile_no: "9876543210",
			sender_name: "Kumar",
			category: 1,
			client_ref_id: "KUMAR 123456789012",
			source_ip: "10.0.0.1",
		});
		const url = ofType(events, "request")[0].url as string;
		expect(url).toContain("client_ref_id=****&");
		expect(url).toContain("utility_acc_no=****2333");
		expect(url).toContain("phone_operator_code=1");
		expect(ofType(events, "response")[0].body.data.client_ref_id).toBe("****");
		expectNoSecrets(events);
		expect(JSON.stringify(events)).not.toContain("123456789012");
	});

	it("scrubs and caps a non-JSON error page, and the error message", async () => {
		const page = `<html><title>502 Bad Gateway</title>${"x".repeat(600)} 123456789012 ${encodeURIComponent("Kumar Abhi")} ${DEV}</html>`;
		const echoFirst = `<html>123456789012 Kumar%20Abhi ${DEV}</html>`;
		const { client, events } = make(
			fetchOf({ status: 502, body: echoFirst + page }),
		);
		await expect(
			client.call("pan-lite", {
				...PAN_LITE,
				name: "Kumar Abhi",
				AADHAR: "123456789012",
			}),
		).rejects.toThrow(/HTTP 502/);
		const response = ofType(events, "response")[0];
		expect(response.status).toBe(502);
		expect(response.body).toMatch(/^<html>\*\*\*\*9012 \*\*\*\* \*\*\*\*<\/html>/);
		expect(response.body).toMatch(/…\(\+\d+ chars\)$/);
		expect(
			Array.from(response.body.replace(/…\(\+\d+ chars\)$/, "")).length,
		).toBe(512);
		const error = ofType(events, "error")[0];
		expect(error.error).toBe("EpsHttpError");
		expectNoSecrets(events);
	});

	it("logs a multipart body as masked fields plus file metadata", async () => {
		const dir = mkdtempSync(path.join(os.tmpdir(), "eps-debug-"));
		try {
			const panPath = path.join(dir, "KUMAR_123456789012.JPG");
			writeFileSync(panPath, "12345");
			const { client, events } = make(fetchOf(ok()));
			await client.call("activate-aeps-fingpay", {
				user_code: "20810200",
				modelname: "MANTRA",
				devicenumber: "D1",
				account: "000111222333",
				ifsc: "SBIN0000001",
				shop_type: "1",
				office_address: { line: "Kumar House" },
				address_as_per_proof: { line: "Kumar House" },
				aadhar: "123456789012",
				pan_card: panPath,
				aadhar_front: new File(["abc"], "front.PNG"),
				aadhar_back: new Blob(["abcd"]),
				latlong: "28.6,77.2",
			});
			const request = ofType(events, "request")[0];
			expect(request.url).toContain(
				"/admin/network/agent/20810200/aeps-fingpay/activate",
			);
			expect(request.body.fields).toMatchObject({
				account: "****2333",
				aadhar: "****9012",
				modelname: "MANTRA",
				office_address: "****",
				latlong: "****",
			});
			expect(request.body.files).toEqual(
				expect.arrayContaining([
					{ param: "pan_card", ext: "jpg", bytes: 5 },
					{ param: "aadhar_front", ext: "png", bytes: 3 },
					{ param: "aadhar_back", ext: null, bytes: 4 },
				]),
			);
			expectNoSecrets(events);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("logs a pre-send failure as a single error event (nothing sent)", async () => {
		const fetchFn = fetchOf(ok());
		const { client, events } = make(fetchFn);
		await expect(client.call("no-such-slug")).rejects.toThrow(
			/Unknown endpoint/,
		);
		await expect(client.call("pan-lite", { name: "Kumar" })).rejects.toThrow(
			/Missing/,
		);
		expect(events.map((e) => e.event)).toEqual(["init", "error", "error"]);
		expect(events[1]).toMatchObject({
			error: "EpsError",
			slug: "no-such-slug",
		});
		expect(fetchFn).not.toHaveBeenCalled();
	});

	it("logs a transport failure, then the error", async () => {
		const { client, events } = make(
			fetchOf(new TypeError(`fetch failed for ${DEV} 9876543210`)),
			{ retries: 0 },
		);
		await expect(
			client.call("bbps-operator-code-circle", {
				customer_mobile: "9876543210",
			}),
		).rejects.toThrow(TypeError);
		expect(events.map((e) => e.event)).toEqual([
			"init",
			"request",
			"transport_error",
			"error",
		]);
		expect(ofType(events, "transport_error")[0]).toMatchObject({
			attempt: 1,
			error: "TypeError",
			message: "fetch failed for **** ****3210",
		});
		expectNoSecrets(events);
	});

	it("logs each retry with its delay", async () => {
		const { client, events } = make(
			fetchOf({ status: 503, body: "busy" }, ok()),
			{
				retries: 1,
			},
		);
		await client.call("bbps-operator-code-circle", {
			customer_mobile: "9876543210",
		});
		expect(events.map((e) => [e.event, e.attempt])).toEqual([
			["init", undefined],
			["request", 1],
			["response", 1],
			["retry", 1],
			["request", 2],
			["response", 2],
		]);
		expect(ofType(events, "retry")[0].delay_ms).toBe(0);
	});

	it("logs the status-check inquiry under its own call id", async () => {
		const { client, events } = make(
			fetchOf({ status: 503, body: "busy" }, ok({ data: { tx_status: 0 } })),
		);
		await expect(
			client.call("dmt-initiate-transfer", {
				recipient_id: 1,
				amount: 100,
				customer_id: "9876543210",
				otp: "4321",
				otp_ref_id: "ref1",
				client_ref_id: "ref123",
			}),
		).rejects.toThrow(EpsIndeterminateError);
		const slugs = events
			.filter((e) => e.event === "request")
			.map((e) => e.slug);
		expect(slugs).toEqual(["dmt-initiate-transfer", "transaction-inquiry"]);
		const errors = ofType(events, "error");
		expect(errors.at(-1)).toMatchObject({
			error: "EpsIndeterminateError",
			client_ref_id: "ref123",
		});
		const ids = new Set(events.filter((e) => e.call_id).map((e) => e.call_id));
		expect(ids.size).toBe(2);
	});

	it("bounds deep and huge bodies", async () => {
		let deep: unknown = "leaf";
		for (let i = 0; i < 12; i++) deep = { data: deep };
		const { client, events } = make(fetchOf(ok(deep as object)));
		await client.call("bbps-operator-code-circle", {
			customer_mobile: "9876543210",
		});
		expect(JSON.stringify(ofType(events, "response")[0].body)).toContain(
			'"****"',
		);
		expect(JSON.stringify(ofType(events, "response")[0].body)).not.toContain(
			"leaf",
		);

		const big = {
			data: Array.from({ length: 3000 }, (_, i) => ({
				tid: `t${i}`.padEnd(50, "0"),
			})),
		};
		const second = make(fetchOf(ok(big)));
		await second.client.call("bbps-operator-code-circle", {
			customer_mobile: "9876543210",
		});
		expect(ofType(second.events, "response")[0].body).toMatch(
			/^\[\d+ bytes omitted\]$/,
		);
	});
});

describe("debug isolation", () => {
	const throwing = () => {
		throw new Error("sink exploded");
	};
	const outcome = async (
		debug: unknown,
		fetchFn: ReturnType<typeof fetchOf>,
		slug: string,
		params: Record<string, unknown>,
	) => {
		const client = new EpsClient({
			developerKey: DEV,
			accessKey: ACCESS,
			environment: "sandbox",
			initiatorId: "9962981729",
			fetch: fetchFn as unknown as typeof fetch,
			now: () => NOW,
			retryBaseDelayMs: 0,
			debug: debug as boolean,
		});
		try {
			return {
				value: await client.call(slug, params),
				calls: fetchFn.mock.calls.length,
			};
		} catch (err) {
			const e = err as EpsIndeterminateError;
			return {
				error: [e.name, e.message, e.statusCheck],
				calls: fetchFn.mock.calls.length,
			};
		}
	};
	const transfer = {
		recipient_id: 1,
		amount: 100,
		customer_id: "9876543210",
		otp: "4321",
		otp_ref_id: "ref1",
		client_ref_id: "ref123",
	};

	it.each([
		[
			"a validation failure",
			() => [fetchOf(ok()), "pan-lite", { name: "x" }] as const,
		],
		[
			"a successful financial call",
			() =>
				[
					fetchOf(ok({ data: { tid: "1" } })),
					"dmt-initiate-transfer",
					transfer,
				] as const,
		],
		[
			"an indeterminate financial call",
			() =>
				[
					fetchOf(
						{ status: 503, body: "busy" },
						ok({ data: { tx_status: 0 } }),
					),
					"dmt-initiate-transfer",
					transfer,
				] as const,
		],
	])("a throwing sink leaves %s unchanged", async (_name, setup) => {
		const [offFetch, slug, params] = setup();
		const [onFetch] = setup();
		const off = await outcome(false, offFetch, slug, params);
		const on = await outcome(throwing, onFetch, slug, params);
		expect(on).toEqual(off);
	});
});

describe("Masker URL alignment", () => {
	const masker = new Masker(
		{ safe: ["tid", "user_code"], last4: ["customer_id"], text: [], nest: [] },
		undefined,
	);
	const base = "https://h/v3";
	const url = (u: string) => masker.url(u, base, "/x/{customer_id}/y", [], []);

	it("masks path params and query values by class", () => {
		expect(url(`${base}/x/9876543210/y?tid=1&k%40x=2`)).toBe(
			`${base}/x/****3210/y?tid=1&#1=****`,
		);
	});

	it("keeps an encoded slash inside its segment", () => {
		expect(url(`${base}/x/98765%2F43210/y`)).toBe(`${base}/x/****3210/y`);
	});

	it("masks a safe query value that is not safe-shaped", () => {
		expect(url(`${base}/x/1/y?tid=KUMAR%20123456789012`)).toBe(
			`${base}/x/****/y?tid=****`,
		);
	});

	it.each([
		["another base", "https://evil/v3/x/1/y"],
		["a different literal segment", `${base}/z/1/y`],
		["an extra segment", `${base}/x/1/y/z`],
		["a malformed escape", `${base}/x/%E0%A4%A/y`],
	])("fails closed on %s", (_name, u) => {
		expect(url(u)).toBe("[unavailable]");
	});
});
