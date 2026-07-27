import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { AuthProvider, UpstreamSession } from "../auth/provider";
import type { Sessions } from "../auth/session";
import type { ConnectClient } from "../clients/connect";
import { createInMemoryKV } from "../store/kv";
import { mountConnect } from "./connect";
import { AppError, errorBody } from "./errors";
import type { AppEnv } from "./requestId";

const NOW = Date.now();

/** A sealed upstream session as `connectProvider.load` would hand one back. */
function upstream(overrides: Partial<UpstreamSession> = {}): UpstreamSession {
	return {
		accessToken: "ca_full",
		refreshToken: "ca_refresh",
		accessTokenLite: "ca_lite",
		accessTokenCrm: "ca_crm",
		accessExpiresAt: NOW + 3_600_000,
		sessionExpiresAt: NOW + 28_800_000,
		...overrides,
	};
}

/**
 * Builds an app with session/provider doubles.
 * @param claim - What `verifyAccess` resolves to; null means no session.
 * @param overrides - Upstream session (or null for expired) and client stubs.
 */
function harness(
	claim: Record<string, unknown> | null,
	overrides: {
		session?: UpstreamSession | null;
		connect?: Partial<ConnectClient>;
		getUpstream?: AuthProvider["getUpstream"];
	} = {},
) {
	const app = new Hono<AppEnv>();
	// Mirrors app.ts's onError so status/code assertions match production.
	app.onError((err, c) => {
		if (err instanceof AppError) {
			return c.json(errorBody(err.code, err.message), err.status as never);
		}
		return c.json(errorBody("UPSTREAM_ERROR", "Something went wrong"), 500);
	});

	const sessions = {
		verifyAccess: vi.fn().mockResolvedValue(claim),
	} as unknown as Sessions;

	const session =
		overrides.session === undefined ? upstream() : overrides.session;
	const auth = {
		name: "connect",
		getUpstream:
			"getUpstream" in overrides
				? overrides.getUpstream
				: vi.fn(async () => session),
	} as unknown as AuthProvider;

	const connect = {
		interactions: vi.fn(async () => [{ id: 491, label: "Load E-value" }]),
		...overrides.connect,
	} as unknown as ConnectClient;

	mountConnect(app, { sessions, auth, connect, kv: createInMemoryKV() });
	return { app, connect, auth };
}

const developer = {
	sub: "9990000001",
	role: "developer",
	orgId: 1,
	sid: "s-1",
};
const withCookie = { headers: { Cookie: "eps_at=token" } };

/** The parsed error envelope of a failed response. */
async function errorOf(res: Response): Promise<{ code: string }> {
	const body = (await res.json()) as { error: { code: string } };
	return body.error;
}

describe("GET /connect/token", () => {
	it("returns only the lite and crm tokens", async () => {
		const { app } = harness(developer);
		const res = await app.request("/connect/token", withCookie);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			accessTokenLite: "ca_lite",
			accessTokenCrm: "ca_crm",
			expiresAt: NOW + 3_600_000,
		});
	});

	it("never exposes the full access or refresh token", async () => {
		const { app } = harness(developer);
		const res = await app.request("/connect/token", withCookie);

		// The whole security posture of this feature in one assertion.
		const body = await res.text();
		expect(body).not.toContain("ca_full");
		expect(body).not.toContain("ca_refresh");
	});

	it("marks the response no-store", async () => {
		const { app } = harness(developer);
		const res = await app.request("/connect/token", withCookie);

		expect(res.headers.get("Cache-Control")).toBe("no-store");
	});

	it("nulls a missing crm token rather than omitting the field", async () => {
		const { app } = harness(developer, {
			session: upstream({ accessTokenCrm: undefined }),
		});
		const res = await app.request("/connect/token", withCookie);

		expect(await res.json()).toMatchObject({ accessTokenCrm: null });
	});

	it("401s without a session", async () => {
		const { app } = harness(null);
		const res = await app.request("/connect/token", withCookie);

		expect(res.status).toBe(401);
		expect((await errorOf(res)).code).toBe("NO_SESSION");
	});

	it("403s a non-developer session", async () => {
		const { app } = harness({ ...developer, role: "admin" });
		const res = await app.request("/connect/token", withCookie);

		expect(res.status).toBe(403);
		expect((await errorOf(res)).code).toBe("NOT_DEVELOPER_SESSION");
	});

	it("501s a session with no sid (the eko provider)", async () => {
		const { app } = harness({ ...developer, sid: undefined });
		const res = await app.request("/connect/token", withCookie);

		expect(res.status).toBe(501);
		expect((await errorOf(res)).code).toBe("CONNECT_UNAVAILABLE");
	});

	it("401s CONNECT_SESSION_EXPIRED once the sealed session is gone", async () => {
		const { app } = harness(developer, { session: null });
		const res = await app.request("/connect/token", withCookie);

		// 401, not 404: the client must re-login deterministically.
		expect(res.status).toBe(401);
		expect((await errorOf(res)).code).toBe("CONNECT_SESSION_EXPIRED");
	});

	it("502s rather than publishing a session with no lite token", async () => {
		const { app } = harness(developer, {
			session: upstream({ accessTokenLite: undefined }),
		});
		const res = await app.request("/connect/token", withCookie);

		expect(res.status).toBe(502);
		expect((await errorOf(res)).code).toBe("CONNECT_TOKEN_MISSING");
	});

	it("rate-limits per session", async () => {
		const { app } = harness(developer);
		let last: Response | undefined;
		// The cap is 60 per window; the 61st must be refused.
		for (let i = 0; i < 61; i++) {
			last = await app.request("/connect/token", withCookie);
		}

		expect(last!.status).toBe(429);
		expect((await errorOf(last!)).code).toBe("RATE_LIMITED");
	});
});

describe("GET /connect/interactions", () => {
	it("returns the role-scoped interaction list", async () => {
		const { app } = harness(developer);
		const res = await app.request("/connect/interactions", withCookie);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			interactions: [{ id: 491, label: "Load E-value" }],
		});
	});

	it("spends the FULL token upstream, which never reaches the browser", async () => {
		const { app, connect } = harness(developer);
		await app.request("/connect/interactions", {
			headers: { ...withCookie.headers, "x-real-ip": "1.2.3.4" },
		});

		expect(connect.interactions).toHaveBeenCalledWith("ca_full", {
			xRealIp: "1.2.3.4",
		});
	});

	it("401s without a session", async () => {
		const { app } = harness(null);
		const res = await app.request("/connect/interactions", withCookie);

		expect(res.status).toBe(401);
		expect((await errorOf(res)).code).toBe("NO_SESSION");
	});
});
