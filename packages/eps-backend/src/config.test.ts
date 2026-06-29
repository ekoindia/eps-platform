import { randomBytes } from "node:crypto";
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

	it("allows http for non-loopback hosts when explicitly opted in", () => {
		expect(
			loadConfig({
				...base,
				SIMPLIBANK_API_SCHEME: "http",
				SIMPLIBANK_ALLOW_INSECURE_HTTP: "true",
			}).eko.scheme,
		).toBe("http");
	});

	it("defaults edit/prod base branches and allows override", () => {
		const base = {
			JWT_SECRET: "x".repeat(32),
			SIMPLIBANK_API_HOST: "h",
			SIMPLIBANK_API_PORT: "1",
			SIMPLIBANK_API_PATH: "/p",
			EKO_DEVELOPER_KEY: "k",
			GITHUB_CLIENT_ID: "g",
			GITHUB_CLIENT_SECRET: "s",
			GITHUB_CALLBACK_URL: "https://x/cb",
			GITHUB_REPO: "o/r",
		};
		const def = loadConfig(base);
		expect(def.github.editBase).toBe("dev");
		expect(def.github.prodBase).toBe("main");
		const over = loadConfig({
			...base,
			GITHUB_EDIT_BASE: "staging",
			GITHUB_PROD_BASE: "release",
		});
		expect(over.github.editBase).toBe("staging");
		expect(over.github.prodBase).toBe("release");
	});
});

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
};

it("defaults to no redis and reject-unauthorized true", () => {
	const cfg = loadConfig({ ...baseEnv });
	expect(cfg.redisUrl).toBeUndefined();
	expect(cfg.redisTlsRejectUnauthorized).toBe(true);
});

it("requires KV_ENCRYPTION_KEY when REDIS_URL is set", () => {
	expect(() => loadConfig({ ...baseEnv, REDIS_URL: "redis://r:6379" })).toThrow(
		/KV_ENCRYPTION_KEY/,
	);
});

it("rejects a KV_ENCRYPTION_KEY that is not 32 bytes", () => {
	expect(() =>
		loadConfig({
			...baseEnv,
			REDIS_URL: "redis://r:6379",
			KV_ENCRYPTION_KEY: randomBytes(16).toString("base64"),
		}),
	).toThrow(/32 bytes/);
});

it("accepts a valid REDIS_URL + 32-byte key and TLS opt-out", () => {
	const cfg = loadConfig({
		...baseEnv,
		REDIS_URL: "rediss://r:6379",
		KV_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
		REDIS_TLS_REJECT_UNAUTHORIZED: "false",
	});
	expect(cfg.redisUrl).toBe("rediss://r:6379");
	expect(cfg.redisTlsRejectUnauthorized).toBe(false);
});
