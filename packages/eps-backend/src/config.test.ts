import { describe, it, expect } from "vitest";
import { loadConfig } from "./config";

const base = {
	JWT_SECRET: "x".repeat(32),
	SIMPLIBANK_API_HOST: "sb.local",
	SIMPLIBANK_API_PORT: "8080",
	SIMPLIBANK_API_PATH: "/v1",
	EKO_DEVELOPER_KEY: "devkey",
	GITHUB_CLIENT_ID: "gid",
	GITHUB_CLIENT_SECRET: "gsecret",
	GITHUB_CALLBACK_URL: "https://eps.eko.in/api/auth/admin/github/callback",
	GITHUB_REPO: "ekoindia/eps-platform",
};

describe("loadConfig", () => {
	it("parses a valid env with sensible defaults", () => {
		const cfg = loadConfig(base);
		expect(cfg.eko.host).toBe("sb.local");
		expect(cfg.eko.initiatorId).toBe("1234567891");
		expect(cfg.eko.userCode).toBe("99029899");
		expect(cfg.eko.defaultOrgId).toBe(1);
		expect(cfg.zoho.enabled).toBe(false);
		expect(cfg.port).toBe(8787);
	});

	it("throws listing all missing required vars", () => {
		expect(() => loadConfig({})).toThrowError(/JWT_SECRET/);
		expect(() => loadConfig({})).toThrowError(/EKO_DEVELOPER_KEY/);
	});

	it("defaults the upstream scheme to https", () => {
		expect(loadConfig(base).eko.scheme).toBe("https");
	});

	it("allows http only for loopback hosts", () => {
		expect(
			loadConfig({
				...base,
				SIMPLIBANK_API_SCHEME: "http",
				SIMPLIBANK_API_HOST: "localhost",
			}).eko.scheme,
		).toBe("http");
	});

	it("rejects http for non-loopback hosts", () => {
		expect(() =>
			loadConfig({ ...base, SIMPLIBANK_API_SCHEME: "http" }),
		).toThrowError(/SIMPLIBANK_API_SCHEME/);
	});
});
