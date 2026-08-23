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
		expect(cfg.eko.timeoutMs).toBe(30_000);
		expect(cfg.eko.devAllowAnyUserType).toBe(false);
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

	it("points history at the main upstream when no override is set", () => {
		expect(loadConfig(base).eko.historyUrl).toBe(
			"https://sb.local:8080/ekoicici/v1/request",
		);
	});

	it("gives history its own host, port and path", () => {
		const cfg = loadConfig({
			...base,
			SIMPLIBANK_HISTORY_API_HOST: "10.100.10.9",
			SIMPLIBANK_HISTORY_API_PORT: "8080",
			SIMPLIBANK_HISTORY_API_PATH: "/eko/v1/request",
			SIMPLIBANK_API_PORT: "25008",
		});
		expect(cfg.eko.historyUrl).toBe("https://10.100.10.9:8080/eko/v1/request");
		// the main upstream is untouched
		expect(cfg.eko.host).toBe("sb.local");
		expect(cfg.eko.port).toBe(25008);
		expect(cfg.eko.path).toBe("/v1");
	});

	it("inherits the parts history does not override", () => {
		expect(
			loadConfig({ ...base, SIMPLIBANK_HISTORY_API_HOST: "10.100.10.9" }).eko
				.historyUrl,
		).toBe("https://10.100.10.9:8080/ekoicici/v1/request");
		expect(
			loadConfig({ ...base, SIMPLIBANK_HISTORY_API_PORT: "9090" }).eko
				.historyUrl,
		).toBe("https://sb.local:9090/ekoicici/v1/request");
	});

	it("treats a blank history override as unset, not as a value", () => {
		expect(
			loadConfig({
				...base,
				SIMPLIBANK_HISTORY_API_HOST: "",
				SIMPLIBANK_HISTORY_API_PORT: "",
			}).eko.historyUrl,
		).toBe("https://sb.local:8080/ekoicici/v1/request");
	});

	it("rejects http to a non-loopback history host inherited from the scheme", () => {
		// Main host is loopback so the main guard passes; history is not, and it
		// inherits SIMPLIBANK_API_SCHEME=http.
		expect(() =>
			loadConfig({
				...base,
				SIMPLIBANK_API_SCHEME: "http",
				SIMPLIBANK_API_HOST: "localhost",
				SIMPLIBANK_HISTORY_API_HOST: "10.100.10.9",
			}),
		).toThrowError(/SIMPLIBANK_HISTORY_API_SCHEME/);
	});

	it("rejects http to a non-loopback history host set explicitly", () => {
		expect(() =>
			loadConfig({
				...base,
				SIMPLIBANK_HISTORY_API_SCHEME: "http",
				SIMPLIBANK_HISTORY_API_HOST: "10.100.10.9",
			}),
		).toThrowError(/SIMPLIBANK_HISTORY_API_SCHEME/);
	});

	it("rejects a history port that is not a valid port", () => {
		expect(() =>
			loadConfig({ ...base, SIMPLIBANK_HISTORY_API_PORT: "not-a-port" }),
		).toThrowError(/valid URL/);
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

describe("connect-api auth provider config", () => {
	it("is absent by default, selecting the direct-to-SimpliBank path", () => {
		expect(loadConfig(baseEnv).connectApi).toBeUndefined();
	});

	it("defaults org to 1 and carries a request timeout", () => {
		const cfg = loadConfig({
			...baseEnv,
			CONNECT_API_BASE_URL: "https://api.beta.ekoconnect.in",
		});
		expect(cfg.connectApi).toEqual({
			baseUrl: "https://api.beta.ekoconnect.in",
			orgId: 1,
			timeoutMs: 15000,
		});
	});

	it("rejects a malformed base URL at boot, not at first login", () => {
		expect(() =>
			loadConfig({ ...baseEnv, CONNECT_API_BASE_URL: "api.ekoconnect.in" }),
		).toThrow(/not a valid URL/);
	});

	it("refuses plaintext http to a non-loopback host", () => {
		// OTPs and access tokens travel over this connection.
		expect(() =>
			loadConfig({
				...baseEnv,
				CONNECT_API_BASE_URL: "http://api.beta.ekoconnect.in",
			}),
		).toThrow(/must be https/);
	});

	it("allows plaintext http to loopback for local development", () => {
		const cfg = loadConfig({
			...baseEnv,
			CONNECT_API_BASE_URL: "http://127.0.0.1:8001",
		});
		expect(cfg.connectApi?.baseUrl).toBe("http://127.0.0.1:8001");
	});

	it("rejects a non-positive CONNECT_ORG_ID", () => {
		expect(() =>
			loadConfig({
				...baseEnv,
				CONNECT_API_BASE_URL: "https://api.beta.ekoconnect.in",
				CONNECT_ORG_ID: "nope",
			}),
		).toThrow(/positive integer/);
	});

	describe("contextMcp", () => {
		it("is absent unless CONTEXT_BUNDLE_URL is set", () => {
			expect(loadConfig(base).contextMcp).toBeUndefined();
		});

		it("parses the bundle URL with a 15-minute default TTL", () => {
			const cfg = loadConfig({
				...base,
				CONTEXT_BUNDLE_URL: "https://eps.eko.in/agent/eps.json",
			});
			expect(cfg.contextMcp).toEqual({
				bundleUrl: "https://eps.eko.in/agent/eps.json",
				ttlSec: 900,
			});
		});

		it("rejects a malformed URL, plaintext to a remote host, or a bad TTL", () => {
			expect(() =>
				loadConfig({ ...base, CONTEXT_BUNDLE_URL: "eps.eko.in/agent" }),
			).toThrowError(/not a valid URL/);
			expect(() =>
				loadConfig({ ...base, CONTEXT_BUNDLE_URL: "http://eps.eko.in/a.json" }),
			).toThrowError(/must be https/);
			expect(() =>
				loadConfig({
					...base,
					CONTEXT_BUNDLE_URL: "https://eps.eko.in/a.json",
					CONTEXT_BUNDLE_TTL_SEC: "0",
				}),
			).toThrowError(/positive integer/);
		});

		it("allows a loopback bundle URL over http for local dev", () => {
			const cfg = loadConfig({
				...base,
				CONTEXT_BUNDLE_URL: "http://localhost:5173/agent/eps.json",
			});
			expect(cfg.contextMcp?.bundleUrl).toBe(
				"http://localhost:5173/agent/eps.json",
			);
		});
	});
});
