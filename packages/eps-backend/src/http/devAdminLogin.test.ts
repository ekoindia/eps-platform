import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { noopSecurityLogger } from "../audit/securityLog";
import { createSessions } from "../auth/session";
import type { GitHubClient } from "../clients/github";
import { loadConfig } from "../config";
import { createInMemoryKV } from "../store/kv";
import { mountAdmin } from "./admin";
import { DEV_ADMIN_SUB, mountDevAdminLogin } from "./devAdminLogin";
import { AppError } from "./errors";
import { requestId, type AppEnv } from "./requestId";

const env = {
	JWT_SECRET: "x".repeat(32),
	SIMPLIBANK_API_HOST: "h",
	SIMPLIBANK_API_PORT: "1",
	SIMPLIBANK_API_PATH: "/p",
	EKO_DEVELOPER_KEY: "k",
	GITHUB_CLIENT_ID: "g",
	GITHUB_CLIENT_SECRET: "s",
	GITHUB_CALLBACK_URL: "https://x/cb",
	GITHUB_REPO: "o/r",
	COOKIE_SECURE: "false",
	DEV_ADMIN_LOGIN: "true",
};

describe("DEV_ADMIN_LOGIN config lock", () => {
	// A copied .env must stop a deployed server from booting, not open it.
	it("refuses to boot under production NODE_ENV or Secure cookies", () => {
		expect(() => loadConfig({ ...env, NODE_ENV: "production" })).toThrow(
			/local-dev only/,
		);
		expect(() => loadConfig({ ...env, COOKIE_SECURE: undefined })).toThrow(
			/local-dev only/,
		);
		expect(() => loadConfig({ ...env, COOKIE_SECURE: "true" })).toThrow(
			/local-dev only/,
		);
	});

	it("is on only when set, and only in dev settings", () => {
		expect(loadConfig(env).devAdminLogin).toBe(true);
		expect(
			loadConfig({ ...env, DEV_ADMIN_LOGIN: undefined }).devAdminLogin,
		).toBe(false);
	});
});

/** `peer: null` = no socket at all (the default param would swallow `undefined`). */
function harness(peer: string | null = "127.0.0.1") {
	const cfg = loadConfig(env);
	const kv = createInMemoryKV();
	const sessions = createSessions(cfg, kv);
	const app = new Hono<AppEnv>();
	app.use("*", requestId());
	app.onError((err, c) =>
		err instanceof AppError
			? c.json({ error: { code: err.code } }, err.status as 400)
			: c.json({ error: { code: "UNHANDLED" } }, 500),
	);
	mountDevAdminLogin(app, {
		cfg,
		sessions,
		securityLog: noopSecurityLogger,
		remoteAddress: () => peer ?? undefined,
	});
	// Real admin routes, to prove the dev session cannot write to the repo.
	mountAdmin(app, { cfg, sessions, kv, github: {} as GitHubClient });
	const login = (headers: Record<string, string> = {}) =>
		app.request("/auth/admin/dev-login", {
			method: "POST",
			headers: { origin: "http://localhost:8080", ...headers },
		});
	return { app, sessions, login };
}

/** The `eps_at=…` pair from a response's Set-Cookie headers. */
const accessCookie = (res: Response): string =>
	(res.headers.getSetCookie().find((c) => c.startsWith("eps_at=")) ?? "").split(
		";",
	)[0];

describe("POST /auth/admin/dev-login", () => {
	it("mints an admin session with no GitHub identity", async () => {
		const { login, sessions } = harness();

		const res = await login();
		const token = accessCookie(res).slice("eps_at=".length);

		expect(res.status).toBe(200);
		expect(await sessions.verifyAccess(token)).toMatchObject({
			sub: DEV_ADMIN_SUB,
			role: "admin",
		});
	});

	it.each([
		["a LAN peer", "192.168.1.20", {}],
		["no socket (unknown peer)", null, {}],
		["an nginx-proxied request", "127.0.0.1", { "x-real-ip": "1.2.3.4" }],
		["a forwarded request", "127.0.0.1", { "x-forwarded-for": "1.2.3.4" }],
	])("refuses %s", async (_label, peer, headers) => {
		const { login } = harness(peer);

		const res = await login(headers);

		expect(res.status).toBe(403);
		expect(await res.json()).toEqual({
			error: { code: "DEV_LOGIN_LOCAL_ONLY" },
		});
	});

	// Login CSRF: another site must not be able to sign this browser in.
	it.each([["https://evil.example"], ["null"], [""]])(
		"refuses origin %j",
		async (origin) => {
			const { login } = harness();

			expect((await login({ origin })).status).toBe(403);
		},
	);

	it("cannot propose or deploy: there is no GitHub token behind it", async () => {
		const { app, login } = harness();
		const cookie = accessCookie(await login());

		const res = await app.request("/admin/deploy/production", {
			method: "POST",
			headers: { cookie },
		});

		expect(res.status).toBe(401);
		expect(await res.json()).toEqual({ error: { code: "NO_GH_TOKEN" } });
	});
});
