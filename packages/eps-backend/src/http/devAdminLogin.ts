import type { Context, Hono } from "hono";
import { getConnInfo } from "@hono/node-server/conninfo";
import type { SecurityLogger } from "../audit/securityLog";
import type { Sessions } from "../auth/session";
import type { Config } from "../config";
import { AppError } from "./errors";
import type { AppEnv } from "./requestId";

/** Subject of every dev-login session; shows up in `/me` and the audit log. */
export const DEV_ADMIN_SUB = "dev:local-admin";

const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Socket peer address under @hono/node-server; undefined anywhere else. */
function socketAddress(c: Context<AppEnv>): string | undefined {
	try {
		return getConnInfo(c).remote.address;
	} catch {
		return undefined;
	}
}

/** True when `origin` is an http(s) URL on a loopback host. */
function isLoopbackOrigin(origin: string | undefined): boolean {
	if (!origin) return false;
	try {
		return LOOPBACK_HOSTS.has(new URL(origin).hostname);
	} catch {
		return false;
	}
}

/**
 * Mounts `POST /auth/admin/dev-login`: an admin session with no GitHub OAuth,
 * so `/admin` can be explored locally without registering a dev OAuth App.
 *
 * Call only when `cfg.devAdminLogin` is true — `loadConfig` already refuses that
 * flag under production settings. Each request must also:
 * - reach the socket from loopback, with no proxy headers (nginx and Vercel
 *   always add `x-real-ip` / `x-forwarded-for`; the Vite dev proxy adds neither);
 * - carry a loopback `Origin`, so another site cannot log the browser in.
 *
 * The session has no `sid` and no stored GitHub token, so GitOps propose/deploy
 * fail with `NO_GH_TOKEN`: it can read admin pages, never write to the repo.
 * @param app - The BFF app.
 * @param deps.remoteAddress - Socket peer resolver; test seam.
 */
export function mountDevAdminLogin(
	app: Hono<AppEnv>,
	deps: {
		cfg: Config;
		sessions: Sessions;
		securityLog: SecurityLogger;
		remoteAddress?: (c: Context<AppEnv>) => string | undefined;
	},
): void {
	const { cfg, sessions, securityLog } = deps;
	const remoteAddress = deps.remoteAddress ?? socketAddress;
	app.post("/auth/admin/dev-login", async (c) => {
		const peer = remoteAddress(c);
		const proxied =
			c.req.header("x-real-ip") !== undefined ||
			c.req.header("x-forwarded-for") !== undefined;
		if (proxied || !peer || !LOOPBACK.has(peer)) {
			throw new AppError(
				403,
				"DEV_LOGIN_LOCAL_ONLY",
				"Dev admin login only works from this machine",
			);
		}
		if (!isLoopbackOrigin(c.req.header("origin"))) {
			throw new AppError(403, "BAD_ORIGIN", "Cross-origin request rejected");
		}

		const claim = {
			sub: DEV_ADMIN_SUB,
			role: "admin" as const,
			orgId: cfg.eko.defaultOrgId,
		};
		const access = await sessions.mintAccess(claim);
		const refresh = await sessions.issueRefresh(claim);
		c.header("Set-Cookie", sessions.accessCookie(access), { append: true });
		c.header(
			"Set-Cookie",
			sessions.refreshCookie(refresh, cfg.adminRefreshTtlSec),
			{ append: true },
		);
		securityLog.loginGranted({
			actor: DEV_ADMIN_SUB,
			ip: peer,
			sid: "none",
			rid: c.get("rid"),
		});
		return c.json({ ok: true });
	});
}
