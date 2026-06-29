import { describe, it, expect } from "vitest";
import { SignJWT } from "jose";
import { createSessions } from "./session";
import { createInMemoryKV } from "../store/kv";
import { loadConfig } from "../config";
import { createSecretBox } from "../store/secretbox";
import { randomBytes } from "node:crypto";

const baseEnv = {
	JWT_SECRET: "x".repeat(32),
	SIMPLIBANK_API_HOST: "h",
	SIMPLIBANK_API_PORT: "1",
	SIMPLIBANK_API_PATH: "/p",
	EKO_DEVELOPER_KEY: "k",
	GITHUB_CLIENT_ID: "g",
	GITHUB_CLIENT_SECRET: "s",
	GITHUB_CALLBACK_URL: "https://x/cb",
	GITHUB_REPO: "o/r",
	ACCESS_TTL_SEC: "900",
};

const cfg = loadConfig(baseEnv);

function mk() {
	let n = 0;
	return createSessions(cfg, createInMemoryKV(), {
		randomId: () => `r${++n}`,
	});
}

describe("Sessions access token", () => {
	it("mints and verifies a claim", async () => {
		const s = mk();
		const t = await s.mintAccess({ sub: "999", role: "developer", orgId: 1 });
		const claim = await s.verifyAccess(t);
		expect(claim?.sub).toBe("999");
		expect(claim?.role).toBe("developer");
	});

	it("preserves sid through mint/verify", async () => {
		const kv = createInMemoryKV();
		const sessions = createSessions(cfg, kv);
		const token = await sessions.mintAccess({
			sub: "gh:octocat",
			role: "admin",
			orgId: 1,
			ghLogin: "octocat",
			sid: "sid-123",
		});
		const claim = await sessions.verifyAccess(token);
		expect(claim?.sid).toBe("sid-123");
	});

	it("rejects garbage tokens", async () => {
		const s = mk();
		expect(await s.verifyAccess("not.a.jwt")).toBeNull();
	});

	it("rejects a token signed with a different algorithm", async () => {
		const s = mk();
		const secret = new TextEncoder().encode(cfg.jwtSecret);
		const hs384 = await new SignJWT({ role: "developer", orgId: 1 })
			.setProtectedHeader({ alg: "HS384" })
			.setIssuer("eps-backend")
			.setSubject("999")
			.setIssuedAt()
			.setExpirationTime("900s")
			.sign(secret);
		expect(await s.verifyAccess(hs384)).toBeNull();
	});

	it("rejects an expired token", async () => {
		const s = mk();
		const secret = new TextEncoder().encode(cfg.jwtSecret);
		const expired = await new SignJWT({ role: "developer", orgId: 1 })
			.setProtectedHeader({ alg: "HS256" })
			.setIssuer("eps-backend")
			.setSubject("999")
			.setIssuedAt(0)
			.setExpirationTime(1)
			.sign(secret);
		expect(await s.verifyAccess(expired)).toBeNull();
	});
});

describe("Sessions cookie security", () => {
	it("includes Secure when cookieSecure is true", () => {
		const secureCfg = loadConfig({ ...baseEnv, COOKIE_SECURE: "true" });
		const s = createSessions(secureCfg, createInMemoryKV());
		expect(s.accessCookie("tok")).toMatch(/Secure/);
	});
});

describe("Sessions refresh", () => {
	it("issues, rotates to a new token, and invalidates the old", async () => {
		const s = mk();
		const claim = { sub: "999", role: "developer" as const, orgId: 1 };
		const r1 = await s.issueRefresh(claim);
		const rotated = await s.rotateRefresh(r1);
		expect(rotated?.refresh).toBeTruthy();
		expect(rotated?.refresh).not.toBe(r1);
		expect(rotated?.claim.sub).toBe("999");
		// old token no longer valid
		expect(await s.rotateRefresh(r1)).toBeNull();
	});

	it("revoke makes a refresh token unusable", async () => {
		const s = mk();
		const r1 = await s.issueRefresh({ sub: "1", role: "admin", orgId: 1 });
		await s.revokeRefresh(r1);
		expect(await s.rotateRefresh(r1)).toBeNull();
	});
});

describe("cookies", () => {
	it("builds httpOnly cookies and clear directives", async () => {
		const s = mk();
		const c = s.accessCookie("tok");
		expect(c).toMatch(/HttpOnly/);
		expect(c).toMatch(/SameSite=Lax/);
		expect(s.clearCookies().length).toBe(2);
	});

	// C2: refreshCookie must accept an explicit ttlSec and reflect it in Max-Age
	it("refreshCookie with explicit ttl produces correct Max-Age", () => {
		const s = mk();
		const c = s.refreshCookie("tok", 28800);
		expect(c).toMatch(/Max-Age=28800/);
	});

	it("refreshCookie without explicit ttl uses cfg.refreshTtlSec", () => {
		const s = mk();
		const c = s.refreshCookie("tok");
		expect(c).toMatch(new RegExp(`Max-Age=${cfg.refreshTtlSec}`));
	});
});

describe("refresh-token KV security", () => {
	it("hashes the refresh token into the KV key (raw token absent)", async () => {
		const kv = createInMemoryKV();
		const sessions = createSessions(cfg, kv);
		const token = await sessions.issueRefresh({
			sub: "9990000001",
			role: "developer",
			orgId: 1,
		});
		// Raw token must not be usable as a KV key.
		expect(await kv.get(`rt:${token}`)).toBeNull();
		// Rotation by the raw token still works (server hashes on lookup).
		const rotated = await sessions.rotateRefresh(token);
		expect(rotated?.claim.sub).toBe("9990000001");
	});

	it("encrypts the refresh value at rest when a real secretbox is used", async () => {
		const kv = createInMemoryKV();
		const secretbox = createSecretBox(randomBytes(32).toString("base64"));
		const sessions = createSessions(cfg, kv, { secretbox });
		const token = await sessions.issueRefresh({
			sub: "9990000002",
			role: "admin",
			orgId: 1,
		});
		// Find the single stored entry by re-deriving the hashed key.
		const { createHash } = await import("node:crypto");
		const stored = await kv.get(
			`rt:${createHash("sha256").update(token).digest("hex")}`,
		);
		expect(stored).not.toBeNull();
		expect(stored).not.toContain("9990000002"); // not plaintext JSON
		const rotated = await sessions.rotateRefresh(token);
		expect(rotated?.claim.sub).toBe("9990000002");
	});
});

describe("admin shorter refresh TTL", () => {
	it("admin refresh expires before developer refresh", async () => {
		// Use a short adminRefreshTtlSec so the test advances time cheaply.
		const adminRefreshTtlSec = 3600; // 1 h
		const testCfg = loadConfig({
			...baseEnv,
			ADMIN_REFRESH_TTL_SEC: String(adminRefreshTtlSec),
		});

		let t = Date.now();
		const kv = createInMemoryKV(() => t);
		let n = 0;
		const sessions = createSessions(testCfg, kv, { randomId: () => `r${++n}` });

		const adminClaim = {
			sub: "gh:octocat",
			role: "admin" as const,
			orgId: 1,
			ghLogin: "octocat",
		};
		const devClaim = {
			sub: "9990000001",
			role: "developer" as const,
			orgId: 1,
		};

		const adminToken = await sessions.issueRefresh(adminClaim);
		const devToken = await sessions.issueRefresh(devClaim);

		// Advance past adminRefreshTtlSec but well before the default refreshTtlSec.
		t += (adminRefreshTtlSec + 1) * 1000;

		expect(await sessions.rotateRefresh(adminToken)).toBeNull();
		expect(await sessions.rotateRefresh(devToken)).not.toBeNull();
	});
});
