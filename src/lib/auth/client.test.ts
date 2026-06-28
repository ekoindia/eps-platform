import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, authClient } from "@/lib/auth/client";

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

afterEach(() => vi.unstubAllGlobals());

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

	it("throws ApiError carrying the envelope code/message on non-2xx", async () => {
		mockFetch([
			{
				status: 401,
				body: {
					error: { code: "OTP_INVALID", message: "Invalid or expired OTP" },
				},
			},
			{
				status: 401,
				body: {
					error: { code: "SESSION_EXPIRED", message: "Session expired" },
				},
			}, // refresh fails
		]);
		await expect(
			authClient.verifyOtp("9990000001", "0000"),
		).rejects.toMatchObject({
			code: "OTP_INVALID",
			httpStatus: 401,
		});
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
});
