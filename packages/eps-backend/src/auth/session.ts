import { SignJWT, jwtVerify } from "jose";
import { randomUUID } from "node:crypto";
import type { Config } from "../config";
import type { KV } from "../store/kv";

export interface SessionClaim {
	sub: string;
	role: "developer" | "admin";
	orgId: number;
	zohoId?: string;
	ghLogin?: string;
}

export interface Sessions {
	mintAccess(claim: SessionClaim): Promise<string>;
	verifyAccess(token: string): Promise<SessionClaim | null>;
	issueRefresh(claim: SessionClaim): Promise<string>;
	rotateRefresh(
		token: string,
	): Promise<{ claim: SessionClaim; refresh: string } | null>;
	revokeRefresh(token: string): Promise<void>;
	accessCookie(token: string): string;
	refreshCookie(token: string): string;
	clearCookies(): string[];
}

export const ACCESS_COOKIE = "eps_at";
export const REFRESH_COOKIE = "eps_rt";

/**
 * Creates a Sessions instance providing JWT access tokens, rotating opaque
 * refresh tokens backed by the given KV store, and Set-Cookie helpers.
 */
export function createSessions(
	cfg: Config,
	kv: KV,
	deps: { randomId?: () => string } = {},
): Sessions {
	const secret = new TextEncoder().encode(cfg.jwtSecret);
	const randomId = deps.randomId ?? (() => randomUUID());
	const refreshKey = (t: string) => `rt:${t}`;

	function cookie(name: string, value: string, ttlSec: number): string {
		const parts = [
			`${name}=${value}`,
			"HttpOnly",
			"Path=/",
			"SameSite=Lax",
			`Max-Age=${ttlSec}`,
		];
		if (cfg.cookieSecure) parts.push("Secure");
		return parts.join("; ");
	}

	return {
		async mintAccess(claim) {
			return new SignJWT({ ...claim })
				.setProtectedHeader({ alg: "HS256" })
				.setIssuer("eps-backend")
				.setSubject(claim.sub)
				.setIssuedAt()
				.setExpirationTime(`${cfg.accessTtlSec}s`)
				.sign(secret);
		},

		async verifyAccess(token) {
			try {
				const { payload } = await jwtVerify(token, secret, {
					issuer: "eps-backend",
				});
				return {
					sub: String(payload.sub),
					role: payload["role"] as SessionClaim["role"],
					orgId: Number(payload["orgId"]),
					zohoId: payload["zohoId"] as string | undefined,
					ghLogin: payload["ghLogin"] as string | undefined,
				};
			} catch {
				return null;
			}
		},

		async issueRefresh(claim) {
			const token = randomId();
			await kv.set(refreshKey(token), JSON.stringify(claim), cfg.refreshTtlSec);
			return token;
		},

		async rotateRefresh(token) {
			const stored = await kv.get(refreshKey(token));
			if (!stored) return null;
			await kv.del(refreshKey(token));
			const claim = JSON.parse(stored) as SessionClaim;
			const next = randomId();
			await kv.set(refreshKey(next), JSON.stringify(claim), cfg.refreshTtlSec);
			return { claim, refresh: next };
		},

		async revokeRefresh(token) {
			await kv.del(refreshKey(token));
		},

		accessCookie(token) {
			return cookie(ACCESS_COOKIE, token, cfg.accessTtlSec);
		},

		refreshCookie(token) {
			return cookie(REFRESH_COOKIE, token, cfg.refreshTtlSec);
		},

		clearCookies() {
			return [cookie(ACCESS_COOKIE, "", 0), cookie(REFRESH_COOKIE, "", 0)];
		},
	};
}
