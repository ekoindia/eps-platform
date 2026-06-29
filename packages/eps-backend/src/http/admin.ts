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

/** Dependencies the admin routes need. */
export interface AdminDeps {
	cfg: Config;
	sessions: Sessions;
	kv: KV;
	github: GitHubClient;
	secretbox?: SecretBox;
}

/** Registers admin-gated GitOps docs routes on the given app. */
export function mountAdmin(app: Hono, deps: AdminDeps): void {
	const { cfg, sessions, kv, github } = deps;
	const secretbox = deps.secretbox ?? passThroughSecretBox;
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
		assertAllowedOrigin(c);
		const { token, login } = await adminToken(c);
		await enforceRateLimit(
			kv,
			`rl:propose:login:${login}`,
			PROPOSE_LIMIT,
			RL_WINDOW_SEC,
		);
		await assertRepoWrite(token, login);
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
		assertAllowedOrigin(c);
		const { token, login } = await adminToken(c);
		await enforceRateLimit(
			kv,
			`rl:deploy:login:${login}`,
			DEPLOY_LIMIT,
			RL_WINDOW_SEC,
		);
		await assertRepoWrite(token, login);
		return c.json(await docs.deployProduction(token));
	});
}
