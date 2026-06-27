export interface Config {
	port: number;
	jwtSecret: string;
	accessTtlSec: number;
	refreshTtlSec: number;
	cookieSecure: boolean;
	corsOrigins: string[];
	eko: {
		scheme: string;
		host: string;
		port: number;
		path: string;
		developerKey: string;
		initiatorId: string;
		userCode: string;
		defaultOrgId: number;
	};
	github: {
		clientId: string;
		clientSecret: string;
		callbackUrl: string;
		repo: string;
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
	if (ekoScheme === "http" && !LOOPBACK_HOSTS.has(ekoHost)) {
		throw new Error(
			`SIMPLIBANK_API_SCHEME=http is only allowed for loopback hosts; refusing plaintext to "${ekoHost}"`,
		);
	}
	return {
		port: Number(env.PORT ?? 8787),
		jwtSecret: env.JWT_SECRET!,
		accessTtlSec: Number(env.ACCESS_TTL_SEC ?? 900),
		refreshTtlSec: Number(env.REFRESH_TTL_SEC ?? 60 * 60 * 24 * 30),
		cookieSecure: env.COOKIE_SECURE !== "false",
		corsOrigins: (env.CORS_ORIGINS ?? "https://eps.eko.in")
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean),
		eko: {
			scheme: ekoScheme,
			host: ekoHost,
			port: Number(env.SIMPLIBANK_API_PORT!),
			path: env.SIMPLIBANK_API_PATH!,
			developerKey: env.EKO_DEVELOPER_KEY!,
			initiatorId: env.EKO_INITIATOR_ID ?? "1234567891",
			userCode: env.EKO_USER_CODE ?? "99029899",
			defaultOrgId: Number(env.EKO_DEFAULT_ORG_ID ?? 1),
		},
		github: {
			clientId: env.GITHUB_CLIENT_ID!,
			clientSecret: env.GITHUB_CLIENT_SECRET!,
			callbackUrl: env.GITHUB_CALLBACK_URL!,
			repo: env.GITHUB_REPO!,
		},
		zoho: {
			enabled: env.ZOHO_ENABLED === "true",
			baseUrl: env.ZOHO_BASE_URL,
			accessToken: env.ZOHO_ACCESS_TOKEN,
		},
	};
}
