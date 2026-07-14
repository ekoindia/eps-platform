import { type EkoLogLevel, parseEkoLogLevel } from "./audit/ekoLog";

export interface Config {
	port: number;
	jwtSecret: string;
	accessTtlSec: number;
	refreshTtlSec: number;
	adminRefreshTtlSec: number;
	cookieSecure: boolean;
	cookieSameSite: string;
	adminPostLoginRedirect: string;
	corsOrigins: string[];
	redisUrl?: string;
	kvEncryptionKey?: string;
	redisTlsRejectUnauthorized: boolean;
	eko: {
		scheme: string;
		host: string;
		port: number;
		path: string;
		developerKey: string;
		initiatorId: string;
		userCode: string;
		defaultOrgId: number;
		logLevel: EkoLogLevel;
	};
	github: {
		clientId: string;
		clientSecret: string;
		callbackUrl: string;
		repo: string;
		editBase: string;
		prodBase: string;
	};
	zoho: { enabled: boolean; baseUrl?: string; accessToken?: string };
}

const REQUIRED = [
	"JWT_SECRET",
	"SIMPLIBANK_API_HOST",
	"SIMPLIBANK_API_PORT",
	"SIMPLIBANK_API_PATH",
	"EKO_DEVELOPER_KEY",
	"GITHUB_CLIENT_ID",
	"GITHUB_CLIENT_SECRET",
	"GITHUB_CALLBACK_URL",
	"GITHUB_REPO",
] as const;

export function loadConfig(env: NodeJS.ProcessEnv): Config {
	const missing = REQUIRED.filter((k) => !env[k]);
	if (missing.length > 0) {
		throw new Error(`Missing required env vars: ${missing.join(", ")}`);
	}
	const ekoScheme = env.SIMPLIBANK_API_SCHEME ?? "https";
	const ekoHost = env.SIMPLIBANK_API_HOST!;
	const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
	const allowInsecureHttp = env.SIMPLIBANK_ALLOW_INSECURE_HTTP === "true";
	if (
		ekoScheme === "http" &&
		!LOOPBACK_HOSTS.has(ekoHost) &&
		!allowInsecureHttp
	) {
		throw new Error(
			`SIMPLIBANK_API_SCHEME=http is only allowed for loopback hosts; refusing plaintext to "${ekoHost}". Set SIMPLIBANK_ALLOW_INSECURE_HTTP=true to opt in for a trusted private-network upstream.`,
		);
	}
	const redisUrl = env.REDIS_URL || undefined;
	const kvEncryptionKey = env.KV_ENCRYPTION_KEY || undefined;
	if (redisUrl) {
		if (!kvEncryptionKey) {
			throw new Error("KV_ENCRYPTION_KEY is required when REDIS_URL is set");
		}
		if (Buffer.from(kvEncryptionKey, "base64").length !== 32) {
			throw new Error("KV_ENCRYPTION_KEY must decode to 32 bytes");
		}
	}
	return {
		port: Number(env.PORT ?? 8787),
		jwtSecret: env.JWT_SECRET!,
		accessTtlSec: Number(env.ACCESS_TTL_SEC ?? 900),
		refreshTtlSec: Number(env.REFRESH_TTL_SEC ?? 60 * 60 * 24 * 30),
		adminRefreshTtlSec: Number(env.ADMIN_REFRESH_TTL_SEC ?? 28800),
		cookieSecure: env.COOKIE_SECURE !== "false",
		cookieSameSite: env.COOKIE_SAMESITE ?? "Lax",
		adminPostLoginRedirect: env.ADMIN_POST_LOGIN_REDIRECT ?? "/admin",
		corsOrigins: (env.CORS_ORIGINS ?? "https://eps.eko.in")
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean),
		redisUrl,
		kvEncryptionKey,
		redisTlsRejectUnauthorized: env.REDIS_TLS_REJECT_UNAUTHORIZED !== "false",
		eko: {
			scheme: ekoScheme,
			host: ekoHost,
			port: Number(env.SIMPLIBANK_API_PORT!),
			path: env.SIMPLIBANK_API_PATH!,
			developerKey: env.EKO_DEVELOPER_KEY!,
			initiatorId: env.EKO_INITIATOR_ID ?? "1234567891",
			userCode: env.EKO_USER_CODE ?? "99029899",
			defaultOrgId: Number(env.EKO_DEFAULT_ORG_ID ?? 1),
			logLevel: parseEkoLogLevel(env.EKO_LOG_LEVEL),
		},
		github: {
			clientId: env.GITHUB_CLIENT_ID!,
			clientSecret: env.GITHUB_CLIENT_SECRET!,
			callbackUrl: env.GITHUB_CALLBACK_URL!,
			repo: env.GITHUB_REPO!,
			editBase: env.GITHUB_EDIT_BASE ?? "dev",
			prodBase: env.GITHUB_PROD_BASE ?? "main",
		},
		zoho: {
			enabled: env.ZOHO_ENABLED === "true",
			baseUrl: env.ZOHO_BASE_URL,
			accessToken: env.ZOHO_ACCESS_TOKEN,
		},
	};
}
