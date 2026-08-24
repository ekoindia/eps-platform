import { describe, expect, it, vi } from "vitest";
import type { EkoLogEntry } from "../audit/ekoLog";
import {
	createConnectClient,
	mapConnectLogin,
	tokensOf,
	type ConnectClient,
	type ConnectLoginEnvelope,
} from "./connect";

const cfg = {
	baseUrl: "https://api.beta.ekoconnect.in",
	orgId: 1,
	timeoutMs: 5000,
};

/** The one shape `clientRefId()` emits — 10 chars, legal on every endpoint. */
const CLIENT_REF_ID = /^[0-9a-z]{10}$/;

/** A minimal `auth_details` for a fully-onboarded EPS business partner. */
function foundDetails(over: Record<string, unknown> = {}) {
	return {
		name: "Dev",
		email: "d@e.in",
		mobile: "9990000001",
		code: 20810282,
		user_type: "23",
		org_id: 1,
		role_list: "13000,13300",
		zoho_id: "ZCRM_9",
		onboarding: 0,
		...over,
	};
}

describe("mapConnectLogin classification", () => {
	it("classifies a fully-onboarded EPS business partner as found", () => {
		const r = mapConnectLogin({ details: foundDetails() }, 1);
		expect(r.kind).toBe("found");
		if (r.kind !== "found") return;
		expect(r.profile.mobile).toBe("9990000001");
		expect(r.profile.zohoId).toBe("ZCRM_9");
		// role_list arrives comma-joined from connect-api, not as an array.
		expect(r.profile.roleList).toEqual(["13000", "13300"]);
	});

	it("classifies an inactive account before anything else", () => {
		// A disabled account still carries a plausible-looking profile; the flag
		// must win, or an inactive business partner would get a developer session.
		const r = mapConnectLogin(
			{
				accountInactive: true,
				response_type_id: 2123,
				details: foundDetails(),
			},
			1,
		);
		expect(r).toEqual({ kind: "inactive", responseTypeId: 2123 });
	});

	it("classifies connect-api's anonymous session as not_found", () => {
		// connect-api substitutes `mobile: '1'` and user_type -1 for an unknown
		// mobile. The placeholder mobile must not trip the blank-mobile guard.
		const r = mapConnectLogin(
			{
				details: { user_type: -1, mobile: "1", onboarding: 1, code: "" },
			},
			1,
		);
		expect(r.kind).toBe("not_found");
	});

	it("reads new-user status from user_type, never role_list", () => {
		// REGRESSION: connect-api overwrites role_list to [-5] for EVERY mobile
		// login (authentication.js:791), discarding the [-2] API-partner value, so
		// a role-based check would misclassify a real partner as a new user.
		const r = mapConnectLogin(
			{ details: foundDetails({ role_list: "-5" }) },
			1,
		);
		expect(r.kind).toBe("found");
	});

	it("checks onboarding BEFORE the business-partner gate", () => {
		// user_type flips to "23" the moment the partial account exists. If the
		// business gate ran first this user would be not_allowed and permanently
		// unable to resume onboarding on their next login.
		const r = mapConnectLogin(
			{ details: foundDetails({ user_type: "23", onboarding: 1 }) },
			1,
		);
		expect(r.kind).toBe("onboarding");
	});

	it("rejects a non-EPS Eloka user as not_allowed", () => {
		// The gate that keeps retailers/distributors out of the developer portal.
		const r = mapConnectLogin({ details: foundDetails({ user_type: "6" }) }, 1);
		expect(r.kind).toBe("not_allowed");
	});

	it("rejects a profile from another org as not_allowed", () => {
		const r = mapConnectLogin({ details: foundDetails({ org_id: 7 }) }, 1);
		expect(r.kind).toBe("not_allowed");
	});

	it("lets a non-partner through as found when devAllowAnyUserType is on", () => {
		// DEV_ALLOW_ANY_USER_TYPE skips the gate, org check included.
		const r = mapConnectLogin(
			{ details: foundDetails({ user_type: "6", org_id: 7 }) },
			1,
			true,
		);
		expect(r.kind).toBe("found");
	});

	it("compares org against the configured org, not a hardcoded 1", () => {
		const r = mapConnectLogin({ details: foundDetails({ org_id: 7 }) }, 7);
		expect(r.kind).toBe("found");
	});

	it("coerces numeric and string spellings of the same fields", () => {
		// These cross a JSON boundary owned by another codebase and arrive as
		// numbers in some branches and strings in others.
		const numeric = mapConnectLogin(
			{ details: foundDetails({ user_type: 23, org_id: "1" }) },
			1,
		);
		expect(numeric.kind).toBe("found");
		const stringy = mapConnectLogin(
			{ details: foundDetails({ onboarding: "1" }) },
			1,
		);
		expect(stringy.kind).toBe("onboarding");
	});

	it("treats a profile with no mobile as an error, not a classification", () => {
		// The mobile is the initiator_id on every later interaction; a blank one
		// would earn a 403 reading "Invalid Sender/Initiator" much later.
		const r = mapConnectLogin({ details: foundDetails({ mobile: "  " }) }, 1);
		expect(r.kind).toBe("error");
	});

	it("treats a details-less envelope as an error", () => {
		expect(mapConnectLogin({}, 1).kind).toBe("error");
	});
});

describe("tokensOf", () => {
	it("derives the long-session refresh window for a mobile login", () => {
		const t = tokensOf({
			access_token: "a",
			refresh_token: "r",
			token_expiration: 18000,
			long_session: true,
		});
		expect(t).toEqual({
			accessToken: "a",
			refreshToken: "r",
			accessTtlSec: 18000,
			sessionTtlSec: 43200 * 60,
		});
	});

	it("uses the short refresh window when long_session is absent", () => {
		expect(
			tokensOf({ access_token: "a", refresh_token: "r" })?.sessionTtlSec,
		).toBe(480 * 60);
	});

	it("falls back to a short access TTL when token_expiration is missing or junk", () => {
		// Degrade toward refreshing sooner rather than never.
		expect(
			tokensOf({ access_token: "a", refresh_token: "r" })?.accessTtlSec,
		).toBe(300);
		expect(
			tokensOf({
				access_token: "a",
				refresh_token: "r",
				token_expiration: "soon" as unknown as number,
			})?.accessTtlSec,
		).toBe(300);
	});

	it("caps an over-large self-reported access TTL", () => {
		expect(
			tokensOf({
				access_token: "a",
				refresh_token: "r",
				token_expiration: 999_999,
			})?.accessTtlSec,
		).toBe(300 * 60);
	});

	it("returns null when connect-api minted no session", () => {
		expect(tokensOf({ otpFailed: true })).toBeNull();
		expect(tokensOf({ access_token: "a" })).toBeNull();
	});
});

describe("createConnectClient", () => {
	function fetchReturning(body: unknown, status = 200) {
		return vi.fn(
			async () =>
				new Response(JSON.stringify(body), {
					status,
					headers: { "content-type": "application/json" },
				}),
		) as unknown as typeof fetch;
	}

	it("posts JSON login with the configured org and forwards the trusted IP", async () => {
		const f = fetchReturning({ access_token: "a", refresh_token: "r" });
		const c = createConnectClient(cfg, f);
		await c.login({ mobile: "9990000001", otp: "123456", xRealIp: "1.2.3.4" });
		const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock
			.calls[0];
		expect(url).toBe("https://api.beta.ekoconnect.in/authentication/login");
		expect((init as RequestInit).headers).toMatchObject({
			"Content-Type": "application/json",
			"X-Real-IP": "1.2.3.4",
		});
		expect(JSON.parse((init as RequestInit).body as string)).toEqual({
			id_type: "Mobile",
			mobile: "9990000001",
			id_token: "123456",
			platform: "web",
			org_id: 1,
			client_ref_id: expect.stringMatching(CLIENT_REF_ID),
		});
	});

	it("omits X-Real-IP entirely when unknown", async () => {
		const f = fetchReturning({ response_status_id: 0 });
		await createConnectClient(cfg, f).sendOtp({ mobile: "9990000001" });
		const [, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
		expect((init as RequestInit).headers).not.toHaveProperty("X-Real-IP");
	});

	// connect-api validates this field on every endpoint and answers
	// response_status_id 1 ("Client reference Id length should be in between 1
	// and 10") when it is missing or too long. Missing on /authentication/sendotp
	// surfaced as a blanket 502 OTP_SEND_FAILED; missing on
	// /authentication/login, one fix later, as a blanket 401 on OTP verify. Hence
	// the transport supplies it and each endpoint is checked here.
	describe("client_ref_id", () => {
		/** Every ref, on every endpoint: exactly 10 characters of [0-9a-z]. */
		function refOfCall(f: typeof fetch, index = 0): string {
			const [, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[
				index
			];
			return JSON.parse((init as RequestInit).body as string).client_ref_id;
		}

		it.each([
			["sendOtp", (c: ConnectClient) => c.sendOtp({ mobile: "9990000001" })],
			["login", (c: ConnectClient) => c.login({ mobile: "9", otp: "1" })],
			["refreshTokens", (c: ConnectClient) => c.refreshTokens("r")],
			["refreshProfile", (c: ConnectClient) => c.refreshProfile("t", "r")],
			["revoke", (c: ConnectClient) => c.revoke("r")],
			["interactions", (c: ConnectClient) => c.interactions("t")],
			["interact", (c: ConnectClient) => c.interact("t", { a: "1" })],
			["interactJson", (c: ConnectClient) => c.interactJson("t", { a: "1" })],
		])("%s sends one", async (_name, call) => {
			const f = fetchReturning({ response_status_id: 0 });
			await call(createConnectClient(cfg, f));
			expect(refOfCall(f)).toMatch(CLIENT_REF_ID);
		});

		it("uploadInteraction sends one inside the formdata part", async () => {
			const f = fetchReturning({ response_status_id: 0 });
			await createConnectClient(cfg, f).uploadInteraction(
				"t",
				{ interaction_type_id: "523" },
				[{ name: "file1", file: new File(["x"], "a.png") }],
			);
			const [, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
			const form = (init as RequestInit).body as FormData;
			const fields = new URLSearchParams(form.get("formdata") as string);
			expect(fields.get("client_ref_id")).toMatch(CLIENT_REF_ID);
		});

		it("overrides any ref a caller supplied, so none can be replayed", async () => {
			const f = fetchReturning({ response_status_id: 0 });
			await createConnectClient(cfg, f).interact("t", {
				client_ref_id: "replayed",
			});
			expect(refOfCall(f)).not.toBe("replayed");
			expect(refOfCall(f)).toMatch(CLIENT_REF_ID);
		});

		it("is distinct per call, including back-to-back ones", async () => {
			const f = fetchReturning({ response_status_id: 0 });
			const c = createConnectClient(cfg, f);
			await Promise.all([c.interact("t", {}), c.interact("t", {})]);
			expect(refOfCall(f, 0)).not.toBe(refOfCall(f, 1));
		});

		it("logs the ref it actually sent", async () => {
			// The log line is how a 107 gets diagnosed; it must not drift from
			// the wire body.
			const entries: EkoLogEntry[] = [];
			const f = fetchReturning({ response_status_id: 0 });
			await createConnectClient(cfg, f, {
				log: (e: EkoLogEntry) => entries.push(e),
			}).login({ mobile: "9", otp: "1" });
			expect(entries[0].fields?.client_ref_id).toBe(refOfCall(f));
		});
	});

	it("refreshProfile posts the stored refresh token under the caller's bearer", async () => {
		// Both halves are load-bearing: the bearer is what authenticates the
		// profile re-read, and `last_refresh_token` is what makes connect-api
		// rotate the EXISTING session document (claim included) instead of
		// creating a second one next to the stale original.
		const f = fetchReturning({ access_token: "a2", refresh_token: "r2" });
		const env = await createConnectClient(cfg, f).refreshProfile(
			"access1",
			"refresh1",
		);
		const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock
			.calls[0];
		expect(url).toBe(
			"https://api.beta.ekoconnect.in/authentication/refresh-profile",
		);
		expect((init as RequestInit).headers).toMatchObject({
			Authorization: "Bearer access1",
		});
		expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({
			last_refresh_token: "refresh1",
		});
		expect(env.access_token).toBe("a2");
	});

	it("does not send api_partner_signup", async () => {
		// connect-api overrides the role for every mobile login anyway, so sending
		// it would imply a guarantee we do not get.
		const f = fetchReturning({});
		await createConnectClient(cfg, f).login({ mobile: "9", otp: "1" });
		const [, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
		expect((init as RequestInit).body as string).not.toContain(
			"api_partner_signup",
		);
	});

	it("returns the envelope verbatim for a wrong OTP answered with HTTP 200", async () => {
		const f = fetchReturning({ otpFailed: true, response_status_id: 1 });
		const env: ConnectLoginEnvelope = await createConnectClient(cfg, f).login({
			mobile: "9",
			otp: "0",
		});
		expect(env.otpFailed).toBe(true);
	});

	it("strips a trailing slash from the configured base URL", async () => {
		const f = fetchReturning({ response_status_id: 0 });
		await createConnectClient(
			{ ...cfg, baseUrl: `${cfg.baseUrl}/` },
			f,
		).sendOtp({
			mobile: "9",
		});
		const [url] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
		expect(url).toBe("https://api.beta.ekoconnect.in/authentication/sendotp");
	});

	it("throws on a non-2xx transport failure", async () => {
		const f = fetchReturning({ error: "boom" }, 500);
		await expect(
			createConnectClient(cfg, f).sendOtp({ mobile: "9" }),
		).rejects.toThrow(/HTTP 500/);
	});

	it("throws on a non-JSON body rather than guessing", async () => {
		const f = vi.fn(
			async () => new Response("<html>gateway</html>", { status: 200 }),
		) as unknown as typeof fetch;
		await expect(
			createConnectClient(cfg, f).sendOtp({ mobile: "9" }),
		).rejects.toThrow(/non-JSON/);
	});
});

describe("createConnectClient upstream logging", () => {
	/** Captures entries instead of serializing, so assertions read the raw shape. */
	function captureLogger() {
		const entries: EkoLogEntry[] = [];
		return { entries, logger: { log: (e: EkoLogEntry) => entries.push(e) } };
	}

	function fetchReturning(body: unknown, status = 200) {
		return vi.fn(
			async () =>
				new Response(JSON.stringify(body), {
					status,
					headers: { "content-type": "application/json" },
				}),
		) as unknown as typeof fetch;
	}

	it("logs the upstream envelope for a business-level failure", async () => {
		// THE REGRESSION: this envelope was the entire cause of a production
		// send-OTP outage and nothing recorded it. A 200 with a non-zero
		// response_status_id must leave a line behind.
		const { entries, logger } = captureLogger();
		const f = fetchReturning({
			response_status_id: 1,
			message: "Client reference Id length should be in between 1 and 10",
		});
		await createConnectClient(cfg, f, logger).sendOtp({ mobile: "9990000001" });
		expect(entries).toHaveLength(1);
		expect(entries[0].path).toBe("/authentication/sendotp");
		expect(entries[0].status).toBe(200);
		expect(entries[0].response).toMatchObject({
			response_status_id: 1,
			message: "Client reference Id length should be in between 1 and 10",
		});
	});

	it("logs exactly once on every exit path", async () => {
		const cases: Array<[string, typeof fetch]> = [
			["success", fetchReturning({ response_status_id: 0 })],
			["non-2xx with JSON", fetchReturning({ error: "boom" }, 500)],
			[
				"non-2xx with non-JSON",
				vi.fn(
					async () => new Response("<html>502</html>", { status: 502 }),
				) as unknown as typeof fetch,
			],
			[
				"2xx with non-JSON",
				vi.fn(
					async () => new Response("<html>ok?</html>", { status: 200 }),
				) as unknown as typeof fetch,
			],
			[
				"transport failure",
				vi.fn(async () => {
					throw new Error("ECONNREFUSED");
				}) as unknown as typeof fetch,
			],
			[
				"body read failure",
				vi.fn(async () => ({
					status: 200,
					ok: true,
					text: async () => {
						throw new Error("socket reset mid-body");
					},
				})) as unknown as typeof fetch,
			],
		];
		for (const [label, f] of cases) {
			const { entries, logger } = captureLogger();
			await createConnectClient(cfg, f, logger)
				.sendOtp({ mobile: "9" })
				.catch(() => {});
			expect(entries, `${label} should log exactly one line`).toHaveLength(1);
		}
	});

	it("records a transport failure with no status, then rethrows", async () => {
		const { entries, logger } = captureLogger();
		const f = vi.fn(async () => {
			throw new Error("ECONNREFUSED");
		}) as unknown as typeof fetch;
		await expect(
			createConnectClient(cfg, f, logger).sendOtp({ mobile: "9" }),
		).rejects.toThrow(/ECONNREFUSED/);
		expect(entries[0].status).toBeUndefined();
		expect(entries[0].error).toMatch(/ECONNREFUSED/);
	});

	it("captures a non-JSON body in the log before throwing", async () => {
		const { entries, logger } = captureLogger();
		const f = vi.fn(
			async () => new Response("<html>gateway</html>", { status: 200 }),
		) as unknown as typeof fetch;
		await expect(
			createConnectClient(cfg, f, logger).sendOtp({ mobile: "9" }),
		).rejects.toThrow(/non-JSON/);
		expect(entries[0].error).toBe("non-JSON response body");
		expect(entries[0].response).toMatchObject({
			nonJson: "<html>gateway</html>",
		});
	});

	it("logs only multipart part NAMES, never the uploaded file contents", async () => {
		// This transport carries KYC scans and selfies.
		const { entries, logger } = captureLogger();
		const f = fetchReturning({ response_status_id: 0 });
		const file = new File(["SECRET-SCAN-BYTES"], "pan.jpg", {
			type: "image/jpeg",
		});
		await createConnectClient(cfg, f, logger).uploadInteraction(
			"token",
			{ interaction_type_id: "523" },
			[{ name: "file1", file }],
		);
		expect(entries[0].fields).toEqual({ multipart_parts: "formdata,file1" });
		expect(JSON.stringify(entries[0].fields)).not.toContain("SECRET-SCAN");
	});

	it("stays silent by default so existing call sites log nothing", async () => {
		// createConnectClient's logger arg is optional; the default must be the
		// no-op, not console.
		const spy = vi.spyOn(console, "log").mockImplementation(() => {});
		const f = fetchReturning({ response_status_id: 0 });
		await createConnectClient(cfg, f).sendOtp({ mobile: "9" });
		expect(spy).not.toHaveBeenCalled();
		spy.mockRestore();
	});
});
