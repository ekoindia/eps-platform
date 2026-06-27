import { describe, it, expect } from "vitest";
import { createSessions } from "./session";
import { createInMemoryKV } from "../store/kv";
import { loadConfig } from "../config";

const cfg = loadConfig({
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
});

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

	it("rejects garbage tokens", async () => {
		const s = mk();
		expect(await s.verifyAccess("not.a.jwt")).toBeNull();
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
});
