import { type EkoLogLevel, parseEkoLogLevel } from "./audit/ekoLog";

export interface Config {
	port: number;
	jwtSecret: string;
	accessTtlSec: number;
	refreshTtlSec: number;
	adminRefreshTtlSec: number;
	/**
	 * DEV/UAT ONLY. Echoes the upstream-returned OTP back to the caller from
	 * `/auth/otp/start` so testers need no SMS. MUST stay false in production:
	 * it would hand anyone who knows a mobile number that number's login code.
	 */
	demoOtp: boolean;
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
		/**
		 * Full upstream URL for interaction 154 (transaction history), which lives
		 * on a different box AND an older API version than everything else — its
		 * own scheme, host, port and path.
		 *
		 * Every part is an optional `SIMPLIBANK_HISTORY_API_*` override that falls
		 * back to the matching `SIMPLIBANK_API_*` value, so a deploy that shares
		 * one box only needs the path (connect-api switches the same way in
		 * `utils/url.js:70-99`, pinning `/ekoicici/v1/request` against
		 * `/ekoicici/v2/request` for the default).
		 */
		historyUrl: string;
		developerKey: string;
		initiatorId: string;
		userCode: string;
		defaultOrgId: number;
		/**
		 * Per-request abort for direct SimpliBank calls. UAT regularly answers
		 * interaction 151 in 10-11s, which the old hardcoded 10s default aborted —
		 * a slow upstream read arriving as a 502 on `/me`.
		 */
		timeoutMs: number;
		logLevel: EkoLogLevel;
		/**
		 * DEV/UAT ONLY. Skips the EPS-business-partner gate (org 1 / user_type 23)
		 * so ANY authenticated Eloka user — retailer, distributor, agent — earns a
		 * developer session. For testing the console with existing test mobiles.
		 * MUST stay false in production: it opens the developer portal to the whole
		 * Eloka user base.
		 *
		 * Lives in the `eko` block because both auth paths need it and both already
		 * receive it: the direct client takes `Config["eko"]`, the connect provider
		 * takes the whole config.
		 */
		devAllowAnyUserType?: boolean;
	};
	/**
	 * Present only when `CONNECT_API_BASE_URL` is set, which selects Eloka's
	 * connect-api as the auth provider instead of calling SimpliBank's OTP
	 * interactions directly. Absent → the original direct path (the default).
	 */
	connectApi?: {
		baseUrl: string;
		/**
		 * The connect-api org this portal authenticates against, and the org a
		 * profile must belong to to earn a developer session. 1 = Eko.
		 */
		orgId: number;
		timeoutMs: number;
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
	// An env var set to "" is unset, not configured: `??` alone would let a blank
	// SIMPLIBANK_HISTORY_API_HOST win over its fallback and build a broken URL.
	const opt = (value: string | undefined) => value || undefined;
	const ekoScheme = opt(env.SIMPLIBANK_API_SCHEME) ?? "https";
	const ekoHost = env.SIMPLIBANK_API_HOST!;
	const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
	const allowInsecureHttp = env.SIMPLIBANK_ALLOW_INSECURE_HTTP === "true";
	const assertSchemeSafe = (
		scheme: string,
		host: string,
		schemeVar: string,
	) => {
		if (scheme === "http" && !LOOPBACK_HOSTS.has(host) && !allowInsecureHttp) {
			throw new Error(
				`${schemeVar}=http is only allowed for loopback hosts; refusing plaintext to "${host}". Set SIMPLIBANK_ALLOW_INSECURE_HTTP=true to opt in for a trusted private-network upstream.`,
			);
		}
	};
	assertSchemeSafe(ekoScheme, ekoHost, "SIMPLIBANK_API_SCHEME");
	// Interaction 154 (history) can sit on its own box, port and API version; each
	// part falls back to the main upstream. The scheme is inherited too, so a
	// history host reached over plaintext http still hits the guard above.
	const historyScheme = opt(env.SIMPLIBANK_HISTORY_API_SCHEME) ?? ekoScheme;
	const historyHost = opt(env.SIMPLIBANK_HISTORY_API_HOST) ?? ekoHost;
	const historyPort =
		opt(env.SIMPLIBANK_HISTORY_API_PORT) ?? env.SIMPLIBANK_API_PORT!;
	const historyPath =
		opt(env.SIMPLIBANK_HISTORY_API_PATH) ?? "/ekoicici/v1/request";
	assertSchemeSafe(historyScheme, historyHost, "SIMPLIBANK_HISTORY_API_SCHEME");
	// `new URL` validates scheme/host/port/path in one shot, brackets IPv6 hosts
	// and drops a redundant default port — a bad value fails at boot, not on the
	// first history request.
	let historyUrl: string;
	try {
		historyUrl = new URL(
			historyPath,
			`${historyScheme}://${historyHost}:${historyPort}`,
		).toString();
	} catch {
		throw new Error(
			`SIMPLIBANK_HISTORY_API_* does not form a valid URL: "${historyScheme}://${historyHost}:${historyPort}${historyPath}"`,
		);
	}
	// Setting CONNECT_API_BASE_URL switches the auth provider. A malformed or
	// plaintext value must fail at boot, not at the first login attempt.
	let connectApi: Config["connectApi"];
	const connectBaseUrl = env.CONNECT_API_BASE_URL || undefined;
	if (connectBaseUrl) {
		let parsed: URL;
		try {
			parsed = new URL(connectBaseUrl);
		} catch {
			throw new Error(
				`CONNECT_API_BASE_URL is not a valid URL: "${connectBaseUrl}"`,
			);
		}
		if (parsed.protocol !== "https:" && !LOOPBACK_HOSTS.has(parsed.hostname)) {
			throw new Error(
				`CONNECT_API_BASE_URL must be https for a non-loopback host; refusing plaintext to "${parsed.hostname}". Access tokens and OTPs travel over this connection.`,
			);
		}
		connectApi = {
			baseUrl: connectBaseUrl,
			orgId: Number(env.CONNECT_ORG_ID ?? 1),
			timeoutMs: Number(env.CONNECT_API_TIMEOUT_MS ?? 15_000),
		};
		if (!Number.isFinite(connectApi.orgId) || connectApi.orgId < 1) {
			throw new Error("CONNECT_ORG_ID must be a positive integer");
		}
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
		demoOtp: env.DEMO_OTP === "true",
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
			historyUrl,
			developerKey: env.EKO_DEVELOPER_KEY!,
			initiatorId: env.EKO_INITIATOR_ID ?? "1234567891",
			userCode: env.EKO_USER_CODE ?? "99029899",
			defaultOrgId: Number(env.EKO_DEFAULT_ORG_ID ?? 1),
			timeoutMs: Number(env.SIMPLIBANK_API_TIMEOUT_MS ?? 30_000),
			logLevel: parseEkoLogLevel(env.EKO_LOG_LEVEL),
			devAllowAnyUserType: env.DEV_ALLOW_ANY_USER_TYPE === "true",
		},
		connectApi,
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
