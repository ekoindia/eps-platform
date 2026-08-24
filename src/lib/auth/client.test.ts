import { afterEach, describe, expect, it, vi } from "vitest";
import {
	ApiError,
	authClient,
	setSessionExpiredHandler,
} from "@/lib/auth/client";

function mockFetch(responses: Array<{ status: number; body: unknown }>) {
	const fn = vi.fn();
	for (const r of responses) {
		fn.mockResolvedValueOnce({
			ok: r.status >= 200 && r.status < 300,
			status: r.status,
			text: async () => JSON.stringify(r.body),
		} as Response);
	}
	vi.stubGlobal("fetch", fn);
	return fn;
}

/**
 * Like `mockFetch`, but the body is returned VERBATIM — `mockFetch` JSON-encodes
 * it, which would turn an HTML string into a perfectly valid JSON document and
 * quietly defeat the point of these cases.
 * @param status - HTTP status to answer with.
 * @param body - Raw response text.
 */
function mockRawFetch(status: number, body: string) {
	const fn = vi.fn().mockResolvedValue({
		ok: status >= 200 && status < 300,
		status,
		text: async () => body,
	} as Response);
	vi.stubGlobal("fetch", fn);
	return fn;
}

/**
 * Like `mockFetch`, but answers by URL rather than by call order — parallel
 * requests interleave, so a fixed sequence would describe a race, not a rule.
 * @param routes - Substring of the URL → the response to answer with.
 */
function mockRoutedFetch(
	routes: Array<{ match: string; status: number; body: unknown }>,
) {
	const fn = vi.fn(async (url: string) => {
		const route = routes.find((r) => url.includes(r.match));
		if (!route) throw new Error(`no mock route for ${url}`);
		return {
			ok: route.status >= 200 && route.status < 300,
			status: route.status,
			text: async () => JSON.stringify(route.body),
		} as Response;
	});
	vi.stubGlobal("fetch", fn);
	return fn;
}

afterEach(() => {
	vi.unstubAllGlobals();
	setSessionExpiredHandler(null);
});

describe("authClient", () => {
	it("startOtp posts mobile and returns ok", async () => {
		const fetchFn = mockFetch([{ status: 200, body: { ok: true } }]);
		const res = await authClient.startOtp("9990000001");
		expect(res).toEqual({ ok: true });
		const [url, init] = fetchFn.mock.calls[0];
		expect(url).toBe("/api/auth/otp/start");
		expect(init.credentials).toBe("include");
		expect(JSON.parse(init.body)).toEqual({ mobile: "9990000001" });
	});

	it("throws ApiError on a 401 OTP error without attempting refresh", async () => {
		const fetchFn = mockFetch([
			{
				status: 401,
				body: {
					error: { code: "OTP_INVALID", message: "Invalid or expired OTP" },
				},
			},
		]);
		await expect(
			authClient.verifyOtp("9990000001", "0000"),
		).rejects.toMatchObject({
			code: "OTP_INVALID",
			httpStatus: 401,
		});
		expect(fetchFn).toHaveBeenCalledTimes(1);
	});

	it("auto-refreshes once on 401 then retries the original request", async () => {
		const fetchFn = mockFetch([
			{ status: 401, body: { error: { code: "NO_SESSION", message: "x" } } }, // /me
			{ status: 200, body: { ok: true } }, // /auth/refresh
			{
				status: 200,
				body: {
					state: "active",
					mobile: "9990000001",
					profile: null,
					zohoId: null,
				},
			}, // retry /me
		]);
		const me = await authClient.me();
		expect(me).toMatchObject({ state: "active" });
		expect(fetchFn).toHaveBeenCalledTimes(3);
		expect(fetchFn.mock.calls[1][0]).toBe("/api/auth/refresh");
	});

	it("does not loop refreshing when refresh itself 401s", async () => {
		const fetchFn = mockFetch([
			{ status: 401, body: { error: { code: "NO_SESSION", message: "x" } } }, // /me
			{
				status: 401,
				body: { error: { code: "SESSION_EXPIRED", message: "y" } },
			}, // refresh fails
		]);
		await expect(authClient.me()).rejects.toBeInstanceOf(ApiError);
		expect(fetchFn).toHaveBeenCalledTimes(2);
	});

	// Production regression: with no VITE_EPS_BACKEND_URL the base is "/api", so
	// on the static host /api/me hit the SPA fallback and came back as 200 +
	// index.html. That used to resolve to an error-shaped object, which the
	// provider then classified as a signed-in developer.
	it("rejects a 200 whose body is not JSON", async () => {
		mockRawFetch(200, '<!doctype html><html lang="en"><head><script>');
		await expect(authClient.me()).rejects.toMatchObject({
			name: "ApiError",
			code: "PARSE_ERROR",
			httpStatus: 200,
		});
	});

	it("still resolves a 200 with an empty body", async () => {
		mockRawFetch(200, "");
		await expect(authClient.me()).resolves.toEqual({});
	});
});

describe("session expiry signal", () => {
	const ME = {
		state: "active",
		mobile: "9990000001",
		profile: null,
		zohoId: null,
	};

	it("stays quiet when the refresh rescues the request", async () => {
		const expired = vi.fn();
		setSessionExpiredHandler(expired);
		mockFetch([
			{ status: 401, body: { error: { code: "NO_SESSION", message: "x" } } },
			{ status: 200, body: { ok: true } }, // refresh
			{ status: 200, body: ME }, // replay
		]);
		await expect(authClient.me()).resolves.toMatchObject({ state: "active" });
		expect(expired).not.toHaveBeenCalled();
	});

	it("fires once when the refresh cannot rescue the request", async () => {
		const expired = vi.fn();
		setSessionExpiredHandler(expired);
		mockFetch([
			{ status: 401, body: { error: { code: "NO_SESSION", message: "x" } } },
			{
				status: 401,
				body: { error: { code: "SESSION_EXPIRED", message: "y" } },
			}, // refresh
		]);
		await expect(authClient.me()).rejects.toBeInstanceOf(ApiError);
		expect(expired).toHaveBeenCalledTimes(1);
	});

	// An admin whose GitHub token died holds a perfectly valid EPS session: the
	// refresh succeeds and the replay 401s anyway.
	it("fires when the replayed request 401s after a successful refresh", async () => {
		const expired = vi.fn();
		setSessionExpiredHandler(expired);
		mockFetch([
			{ status: 401, body: { error: { code: "NO_GH_TOKEN", message: "x" } } },
			{ status: 200, body: { ok: true } }, // refresh
			{ status: 401, body: { error: { code: "NO_GH_TOKEN", message: "x" } } },
		]);
		await expect(authClient.adminDocs.list()).rejects.toMatchObject({
			code: "NO_GH_TOKEN",
		});
		expect(expired).toHaveBeenCalledTimes(1);
	});

	it("stays quiet on a rejected OTP", async () => {
		const expired = vi.fn();
		setSessionExpiredHandler(expired);
		mockFetch([
			{ status: 401, body: { error: { code: "OTP_INVALID", message: "x" } } },
		]);
		await expect(authClient.verifyOtp("9990000001", "0000")).rejects.toThrow();
		expect(expired).not.toHaveBeenCalled();
	});

	it("stays quiet when logging out of an already-dead session", async () => {
		const expired = vi.fn();
		setSessionExpiredHandler(expired);
		mockFetch([
			{ status: 401, body: { error: { code: "NO_SESSION", message: "x" } } },
			{ status: 200, body: { ok: true } }, // refresh
			{ status: 401, body: { error: { code: "NO_SESSION", message: "x" } } },
		]);
		await expect(authClient.logout()).rejects.toBeInstanceOf(ApiError);
		expect(expired).not.toHaveBeenCalled();
	});

	// The decisive one. Refresh tokens are single-use (the backend rotates with a
	// `getdel`), so one refresh per 401 would have the first request consume the
	// token and every sibling 401 on a session that was just renewed — signing the
	// user out of a perfectly good session.
	it("shares one refresh across simultaneous 401s and expires none of them", async () => {
		const expired = vi.fn();
		setSessionExpiredHandler(expired);
		let refreshed = false;
		const fetchFn = vi.fn(async (url: string) => {
			if (url.includes("/auth/refresh")) {
				refreshed = true;
				return {
					ok: true,
					status: 200,
					text: async () => JSON.stringify({ ok: true }),
				} as Response;
			}
			// Every protected call 401s until the single rotation lands.
			return refreshed
				? ({
						ok: true,
						status: 200,
						text: async () => JSON.stringify(ME),
					} as Response)
				: ({
						ok: false,
						status: 401,
						text: async () =>
							JSON.stringify({ error: { code: "NO_SESSION", message: "x" } }),
					} as Response);
		});
		vi.stubGlobal("fetch", fetchFn);

		const results = await Promise.all([
			authClient.me(),
			authClient.me(),
			authClient.me(),
		]);

		expect(results).toHaveLength(3);
		expect(expired).not.toHaveBeenCalled();
		const refreshCalls = fetchFn.mock.calls.filter(([url]) =>
			String(url).includes("/auth/refresh"),
		);
		expect(refreshCalls).toHaveLength(1);
	});

	it("expires every simultaneous 401 through a single shared refresh attempt", async () => {
		const expired = vi.fn();
		setSessionExpiredHandler(expired);
		const fetchFn = mockRoutedFetch([
			{
				match: "/auth/refresh",
				status: 401,
				body: { error: { code: "SESSION_EXPIRED", message: "y" } },
			},
			{
				match: "/me",
				status: 401,
				body: { error: { code: "NO_SESSION", message: "x" } },
			},
		]);

		await Promise.all([
			expect(authClient.me()).rejects.toBeInstanceOf(ApiError),
			expect(authClient.me()).rejects.toBeInstanceOf(ApiError),
		]);

		const refreshCalls = fetchFn.mock.calls.filter(([url]) =>
			String(url).includes("/auth/refresh"),
		);
		expect(refreshCalls).toHaveLength(1);
		// The provider dedupes; the client's job is only to report every one.
		expect(expired).toHaveBeenCalledTimes(2);
	});
});

/**
 * The diagnostics an error carries. These are what a screenshot has to be able
 * to show, so each one is a rule about what survives a failure — not a detail.
 */
describe("error diagnostics", () => {
	/** A response whose headers behave like a real one's. */
	function mockWithHeaders(
		status: number,
		body: unknown,
		headers: Record<string, string>,
	) {
		const fn = vi.fn().mockResolvedValue({
			ok: status >= 200 && status < 300,
			status,
			headers: new Headers(headers),
			text: async () => JSON.stringify(body),
		} as Response);
		vi.stubGlobal("fetch", fn);
		return fn;
	}

	it("reads the request id from the header even when the body is unparseable", async () => {
		// The case with least else to go on: a proxy error page, no envelope. The
		// header is the only thing left that names the request.
		const fn = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			headers: new Headers({ "x-request-id": "rid-header" }),
			text: async () => "<!doctype html>",
		} as Response);
		vi.stubGlobal("fetch", fn);
		await expect(authClient.me()).rejects.toMatchObject({
			code: "PARSE_ERROR",
			source: "client",
			requestId: "rid-header",
		});
	});

	it("prefers the body's rid, which agrees with the header", async () => {
		mockWithHeaders(
			502,
			{ error: { code: "UPSTREAM_ERROR", message: "x", source: "proxy" } , rid: "rid-body" },
			{ "x-request-id": "rid-body" },
		);
		await expect(authClient.me()).rejects.toMatchObject({
			requestId: "rid-body",
		});
	});

	it("carries source, trace and version off the envelope", async () => {
		mockWithHeaders(
			502,
			{
				error: { code: "KYC_LIST_FAILED", message: "nope", source: "api" },
				rid: "rid-1",
				ts: "2026-08-25T00:00:00.000Z",
				version: "abc123",
				trace: [{ path: "/p", clientRefId: "ref-9", status: 200, durMs: 3, error: null }],
			},
			{},
		);
		const err = await authClient.me().catch((e: unknown) => e);
		expect(err).toBeInstanceOf(ApiError);
		const api = err as ApiError;
		expect(api.source).toBe("api");
		expect(api.version).toBe("abc123");
		expect(api.serverTime).toBe("2026-08-25T00:00:00.000Z");
		expect(api.trace?.[0].clientRefId).toBe("ref-9");
	});

	it("defaults an envelope-less error to `proxy`, not `client`", async () => {
		// A server answered; the shape was just unrecognised. Blaming the browser
		// would send ops to the wrong team.
		mockWithHeaders(500, { nope: true }, {});
		await expect(authClient.me()).rejects.toMatchObject({
			code: "HTTP_ERROR",
			source: "proxy",
		});
	});

	it("turns an unreachable server into a named client error", async () => {
		// Previously a bare TypeError reached callers and each invented its own
		// "Network error" string, indistinguishable from a backend fault.
		vi.stubGlobal(
			"fetch",
			vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
		);
		const err = await authClient.me().catch((e: unknown) => e);
		expect(err).toBeInstanceOf(ApiError);
		expect(err).toMatchObject({
			code: "NETWORK_ERROR",
			source: "client",
			httpStatus: 0,
		});
	});
});
