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
	/**
	 * Present only when `CONTEXT_BUNDLE_URL` is set, which mounts the anonymous
	 * eps-context-mcp server at `/context/*` (public: mcp.eko.in/context/mcp).
	 * Absent → those routes do not exist at all.
	 */
	contextMcp?: {
		/** Live agent bundle, re-validated on `ttlSec` so docs edits reach agents. */
		bundleUrl: string;
		ttlSec: number;
	};
	/**
	 * Present only when a provider AND key are configured, which is what mounts
	 * `POST /chat/ask`. Absent → the route answers 503 CHAT_DISABLED and the
	 * feature is dark. Chat also needs `contextMcp` for its bundle.
	 */
	chat?: {
		provider: "anthropic" | "openai" | "openrouter";
		model: string;
		apiKey: string;
		/** Overrides the provider default (self-host, gateway, OpenRouter). */
		baseUrl?: string;
		/**
		 * Monthly cost guard in USD; 0 disables it. Requires both prices — they
		 * cannot be inferred from an arbitrary model id or base URL, and guessing
		 * would silently misprice every request.
		 */
		monthlyBudgetUsd: number;
		inputPerMTok: number;
		outputPerMTok: number;
	};
	/**
	 * Present only when `ACTIVATION_FEE_WEBHOOK_URL` is set, which is what makes
	 * `POST /activation-fee/intimate` able to send. Absent → the route still
	 * mounts and answers 503 ACTIVATION_FEE_DISABLED, so a partner sees "we
	 * can't take this right now" rather than a 404 on a page they were sent to.
	 *
	 * The URL is a secret: it is an unauthenticated webhook that mails Eko
	 * staff, so it must never reach the browser bundle.
	 */
	activationFee?: {
		webhookUrl: string;
		/** Mailbox list the intimation is addressed to. */
		recipients: string[];
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
	// Setting CONTEXT_BUNDLE_URL mounts the public MCP server; a malformed or
	// plaintext value must fail at boot rather than serve a broken endpoint.
	let contextMcp: Config["contextMcp"];
	const contextBundleUrl = env.CONTEXT_BUNDLE_URL || undefined;
	if (contextBundleUrl) {
		let parsed: URL;
		try {
			parsed = new URL(contextBundleUrl);
		} catch {
			throw new Error(
				`CONTEXT_BUNDLE_URL is not a valid URL: "${contextBundleUrl}"`,
			);
		}
		if (parsed.protocol !== "https:" && !LOOPBACK_HOSTS.has(parsed.hostname)) {
			throw new Error(
				`CONTEXT_BUNDLE_URL must be https for a non-loopback host; refusing plaintext to "${parsed.hostname}".`,
			);
		}
		const ttlSec = Number(env.CONTEXT_BUNDLE_TTL_SEC ?? 900);
		if (!Number.isFinite(ttlSec) || ttlSec < 1) {
			throw new Error("CONTEXT_BUNDLE_TTL_SEC must be a positive integer");
		}
		contextMcp = { bundleUrl: contextBundleUrl, ttlSec };
	}

	// Chat is opt-in per environment: deploying the code with no EPS_CHAT_* set
	// leaves the feature fully dark. Half-configuring it is a boot error rather
	// than a runtime surprise on the first user question.
	let chat: Config["chat"];
	const chatProvider = env.EPS_CHAT_PROVIDER || undefined;
	const chatApiKey = env.EPS_CHAT_API_KEY || undefined;
	if (chatProvider || chatApiKey) {
		if (!chatProvider || !chatApiKey) {
			throw new Error(
				"EPS_CHAT_PROVIDER and EPS_CHAT_API_KEY must be set together",
			);
		}
		if (
			chatProvider !== "anthropic" &&
			chatProvider !== "openai" &&
			chatProvider !== "openrouter"
		) {
			throw new Error(
				`EPS_CHAT_PROVIDER must be anthropic, openai or openrouter; got "${chatProvider}"`,
			);
		}
		const model = env.EPS_CHAT_MODEL || "claude-haiku-4-5";
		const baseUrl = env.EPS_CHAT_BASE_URL || undefined;
		if (baseUrl) {
			let parsedBase: URL;
			try {
				parsedBase = new URL(baseUrl);
			} catch {
				throw new Error(`EPS_CHAT_BASE_URL is not a valid URL: "${baseUrl}"`);
			}
			if (
				parsedBase.protocol !== "https:" &&
				!LOOPBACK_HOSTS.has(parsedBase.hostname)
			) {
				throw new Error(
					`EPS_CHAT_BASE_URL must be https for a non-loopback host; refusing plaintext to "${parsedBase.hostname}".`,
				);
			}
		}
		const monthlyBudgetUsd = Number(env.EPS_CHAT_MONTHLY_BUDGET_USD ?? 0);
		if (!Number.isFinite(monthlyBudgetUsd) || monthlyBudgetUsd < 0) {
			throw new Error("EPS_CHAT_MONTHLY_BUDGET_USD must be a non-negative number");
		}
		const inputPerMTok = Number(env.EPS_CHAT_PRICE_INPUT_PER_MTOK ?? 0);
		const outputPerMTok = Number(env.EPS_CHAT_PRICE_OUTPUT_PER_MTOK ?? 0);
		if (monthlyBudgetUsd > 0) {
			// Without prices the budget cannot be enforced, and a silently
			// unenforced spend cap is worse than an obvious absent one.
			if (
				!Number.isFinite(inputPerMTok) ||
				inputPerMTok <= 0 ||
				!Number.isFinite(outputPerMTok) ||
				outputPerMTok <= 0
			) {
				throw new Error(
					"EPS_CHAT_PRICE_INPUT_PER_MTOK and EPS_CHAT_PRICE_OUTPUT_PER_MTOK must be positive when EPS_CHAT_MONTHLY_BUDGET_USD is set",
				);
			}
		}
		chat = {
			provider: chatProvider,
			model,
			apiKey: chatApiKey,
			baseUrl,
			monthlyBudgetUsd,
			inputPerMTok,
			outputPerMTok,
		};
	}
	// Setting ACTIVATION_FEE_WEBHOOK_URL arms the activation-fee intimation mail.
	// A malformed or plaintext value must fail at boot: this URL carries partner
	// PAN/GST and a payment reference to an unauthenticated endpoint.
	let activationFee: Config["activationFee"];
	const activationFeeUrl = env.ACTIVATION_FEE_WEBHOOK_URL || undefined;
	if (activationFeeUrl) {
		let parsed: URL;
		try {
			parsed = new URL(activationFeeUrl);
		} catch {
			throw new Error(
				`ACTIVATION_FEE_WEBHOOK_URL is not a valid URL: "${activationFeeUrl}"`,
			);
		}
		if (parsed.protocol !== "https:" && !LOOPBACK_HOSTS.has(parsed.hostname)) {
			throw new Error(
				`ACTIVATION_FEE_WEBHOOK_URL must be https for a non-loopback host; refusing plaintext to "${parsed.hostname}". Partner PAN, GST and payment references travel over this connection.`,
			);
		}
		const recipients = (
			env.ACTIVATION_FEE_RECIPIENTS ??
			"eps@eko.in,finance@eko.co.in,amar@eko.co.in"
		)
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
		// An explicitly-emptied list would send the mail to nobody and report
		// success — silently losing every payment intimation.
		if (recipients.length === 0) {
			throw new Error(
				"ACTIVATION_FEE_RECIPIENTS is set but lists no addresses; unset it to use the default, or name at least one mailbox",
			);
		}
		const bad = recipients.filter((address) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address));
		if (bad.length > 0) {
			throw new Error(
				`ACTIVATION_FEE_RECIPIENTS contains invalid addresses: ${bad.join(", ")}`,
			);
		}
		const timeoutMs = Number(env.ACTIVATION_FEE_TIMEOUT_MS ?? 20_000);
		if (!Number.isFinite(timeoutMs) || timeoutMs < 1) {
			throw new Error("ACTIVATION_FEE_TIMEOUT_MS must be a positive integer");
		}
		activationFee = { webhookUrl: activationFeeUrl, recipients, timeoutMs };
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
		contextMcp,
		chat,
		activationFee,
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
