import type { Hono, Context } from "hono";
import { getCookie } from "hono/cookie";
import { ACCESS_COOKIE, type Sessions } from "../auth/session";
import type { KV } from "../store/kv";
import type { GitHubClient } from "../clients/github";
import type { Config } from "../config";
import { AppError } from "./errors";
import { createDocsService } from "../admin/docsService";
import { passThroughSecretBox, type SecretBox } from "../store/secretbox";
import {
	enforceRateLimit,
	PROPOSE_LIMIT,
	DEPLOY_LIMIT,
	RL_WINDOW_SEC,
} from "./rateLimit";
import { type SecurityLogger, noopSecurityLogger } from "../audit/securityLog";

/** Dependencies the admin routes need. */
export interface AdminDeps {
	cfg: Config;
	sessions: Sessions;
	kv: KV;
	github: GitHubClient;
	secretbox?: SecretBox;
	securityLog?: SecurityLogger;
}

/** Registers admin-gated GitOps docs routes on the given app. */
export function mountAdmin(app: Hono, deps: AdminDeps): void {
	const { cfg, sessions, kv, github } = deps;
	const secretbox = deps.secretbox ?? passThroughSecretBox;
	const securityLog = deps.securityLog ?? noopSecurityLogger;
	const docs = createDocsService(github, cfg);

	/**
	 * Rejects a cross-origin browser POST: if an Origin header is present,
	 * it must be in the CORS allowlist. Missing Origin (non-browser / same-origin
	 * tooling) passes through to the cookie+role+token gate.
	 */
	function assertAllowedOrigin(c: Context): void {
		const origin = c.req.header("origin");
		if (origin && !cfg.corsOrigins.includes(origin)) {
			throw new AppError(403, "BAD_ORIGIN", "Cross-origin request rejected");
		}
	}

	/** Re-checks live repo-write access; fail-closed before a privileged mutation. */
	async function assertRepoWrite(token: string, login: string): Promise<void> {
		const status = await github.checkRepoWrite(token, login);
		if (status === "no-write") {
			throw new AppError(
				403,
				"WRITE_ACCESS_REVOKED",
				"Repository write access revoked — sign in again",
			);
		}
		if (status === "unknown") {
			throw new AppError(
				503,
				"UPSTREAM_UNAVAILABLE",
				"Could not verify repository access — try again shortly",
			);
		}
		// "write" → proceed
	}

	/** Resolves the acting admin's GitHub token + login, or throws 403/401. */
	async function adminToken(
		c: Context,
	): Promise<{ token: string; login: string }> {
		const at = getCookie(c, ACCESS_COOKIE);
		const claim = at ? await sessions.verifyAccess(at) : null;
		if (!claim || claim.role !== "admin") {
			throw new AppError(403, "NOT_AUTHORIZED", "Admin access required");
		}
		const stored = claim.sid ? await kv.get(`ghtoken:${claim.sid}`) : null;
		const token = stored ? secretbox.decrypt(stored) : null;
		if (!token) {
			throw new AppError(
				401,
				"NO_GH_TOKEN",
				"GitHub session expired — sign in again",
			);
		}
		return { token, login: claim.ghLogin ?? claim.sub };
	}

	/**
	 * Runs the privileged-mutation gate sequence (origin → admin token →
	 * per-login rate limit → live repo-write re-check) and returns the acting
	 * admin's token + login. Any AppError denial is recorded as a security
	 * event (actor is the resolved @login once known, else "unknown") and then
	 * rethrown unchanged. Mid-work GitHub errors occur AFTER this gate and are
	 * therefore never logged here.
	 */
	async function runMutationGate(
		c: Context,
		action: "propose" | "deploy",
		limit: number,
	): Promise<{ token: string; login: string }> {
		const ip = c.req.header("x-real-ip") ?? "unknown";
		let actor = "unknown";
		try {
			assertAllowedOrigin(c);
			const { token, login } = await adminToken(c);
			actor = `@${login}`;
			await enforceRateLimit(
				kv,
				`rl:${action}:login:${login}`,
				limit,
				RL_WINDOW_SEC,
			);
			await assertRepoWrite(token, login);
			return { token, login };
		} catch (e) {
			if (e instanceof AppError) {
				securityLog.mutationDenied({ action, actor, ip, reason: e.code });
			}
			throw e;
		}
	}

	app.get("/admin/docs", async (c) => {
		const { token } = await adminToken(c);
		return c.json({ docs: await docs.list(token) });
	});

	app.get("/admin/docs/content", async (c) => {
		const { token } = await adminToken(c);
		const path = c.req.query("path");
		if (!path) throw new AppError(400, "INVALID_INPUT", "path is required");
		return c.json(await docs.getDoc(token, path));
	});

	app.post("/admin/docs/propose", async (c) => {
		const { token, login } = await runMutationGate(c, "propose", PROPOSE_LIMIT);
		const b = (await c.req.json().catch(() => ({}))) as {
			path?: unknown;
			content?: unknown;
			baseSha?: unknown;
			summary?: unknown;
		};
		if (
			typeof b.path !== "string" ||
			typeof b.content !== "string" ||
			typeof b.baseSha !== "string"
		) {
			throw new AppError(
				400,
				"INVALID_INPUT",
				"path, content, baseSha are required",
			);
		}
		const summary = typeof b.summary === "string" ? b.summary : "";
		return c.json(
			await docs.propose(token, {
				path: b.path,
				content: b.content,
				baseSha: b.baseSha,
				summary,
				login,
			}),
		);
	});

	app.post("/admin/deploy/production", async (c) => {
		const { token } = await runMutationGate(c, "deploy", DEPLOY_LIMIT);
		return c.json(await docs.deployProduction(token));
	});
}
