/**
 * Shared authentication configuration for Eko's REST APIs.
 *
 * Every API call uses the same auth headers and signing scheme, so it is
 * defined ONCE here and referenced by every {@link ApiSpec} (via the resolvers
 * in `api-specs-common.ts`) instead of being duplicated per endpoint.
 *
 * Source: https://eps.eko.in/docs/how-auth-works
 */
import { API_DEFAULT_VERSION, SITE_URL } from "@/lib/config/site";
import type { ApiParam } from "./api-specs-common";

/** Portal docs page describing the auth flow in full. */
export const API_AUTH_DOCS_URL = "/docs/how-auth-works";

/** API path version (cf. the `/ekoapi/<version>` URL segment). */
export const API_VERSION = API_DEFAULT_VERSION;

// ---------------------------------------------------------------------------
// Environments — share the same paths, differ only by base URL
// ---------------------------------------------------------------------------

export interface ApiEnvironment {
	label: string;
	baseUrl: string;
	/** Whether credentials are self-serve (sandbox) or issued post-KYC (prod). */
	note?: string;
}

export const API_ENVIRONMENTS: Record<
	"sandbox" | "production",
	ApiEnvironment
> = {
	sandbox: {
		label: "UAT / Sandbox",
		baseUrl: `https://staging.eko.in/ekoapi/${API_VERSION}`,
		note: "Credentials self-issued on signup. Use for development and testing. Login to Console to view your sandbox credentials.",
	},
	production: {
		label: "Production",
		baseUrl: `https://api.eko.in/ekoicici/${API_VERSION}`,
		note: "Credentials issued after organizational KYC.",
	},
};

/**
 * Sandbox note for AI-agent surfaces (agent bundle → MCP `environments` topic,
 * context packs). Humans are told to sign up and read their keys off the
 * Console (`API_ENVIRONMENTS.sandbox.note`); agents get the zero-signup path:
 * the shared public UAT keypair is published in llms.txt / index.md (see
 * `aiGettingStartedNotice` and the header of `lib/uat-credentials.ts`). The key
 * values themselves are deliberately NOT repeated in the bundle.
 */
export const AGENT_SANDBOX_NOTE =
	"Shared public UAT keypair — no signup needed. The developer_key and " +
	`access_key for this environment are published in ${SITE_URL}/llms.txt ` +
	"(and index.md); use them for development and testing only (scoped, " +
	"quota'd, rotatable). Production credentials are issued after " +
	"organizational KYC.";

/** Default base URL used to build full endpoint URLs in previews/portal. */
export const DEFAULT_BASE_URL = API_ENVIRONMENTS.sandbox.baseUrl;

// ---------------------------------------------------------------------------
// Auth headers — identical on every request
// ---------------------------------------------------------------------------

export const AUTH_HEADERS: ApiParam[] = [
	{
		name: "developer_key",
		in: "header",
		type: "string",
		required: true,
		description: "Static API key issued to your account after KYC.",
	},
	{
		name: "secret-key",
		in: "header",
		type: "string",
		required: true,
		description:
			"Dynamic per-request signature: base64(HMAC-SHA256(timestamp, base64(access_key))).",
	},
	{
		name: "secret-key-timestamp",
		in: "header",
		type: "string",
		required: true,
		description:
			"Current time in milliseconds since UNIX epoch, used to compute secret-key. Must match server time.",
	},
	{
		name: "content-type",
		in: "header",
		type: "string",
		required: true,
		description: "application/json",
		example: "application/json",
	},
];

// ---------------------------------------------------------------------------
// Structured auth notes — enough to render a portal "Authentication" page
// ---------------------------------------------------------------------------

export interface ApiKeyInfo {
	name: string;
	description: string;
}

export const API_AUTH_INFO = {
	docsUrl: API_AUTH_DOCS_URL,
	keys: [
		{
			name: "Access Key",
			description:
				"Core secret shared via email and kept server-side only. Never exposed in requests; used to compute the secret-key.",
		},
		{
			name: "Developer Key",
			description:
				"Environment-specific identifier sent as the developer_key header. UAT key from the platform credentials section; production key issued after KYC.",
		},
	] as ApiKeyInfo[],
	secretKeyGeneration: [
		"Base64-encode the access_key.",
		"Generate the current timestamp in milliseconds (as a string).",
		"Compute HMAC-SHA256 of the timestamp using the base64-encoded key.",
		"Base64-encode the resulting signature — this is the secret-key.",
	],
	/**
	 * Known-answer test for the secret-key algorithm.
	 *
	 * `accessKey` is a dummy string, NOT a credential — the point is that an
	 * integrator (or an AI agent) can prove their signing code is correct without
	 * ever handling a real key. Run your own implementation over these inputs; if
	 * it reproduces `secretKey`, the HMAC is right and a 401 is coming from
	 * somewhere else. Pinned against `node:crypto` in `api-auth.test.ts`.
	 */
	testVector: {
		accessKey: "test-access-key-123",
		timestamp: "1700000000000",
		secretKey: "88lqTf9ew69XbVbeczjxVL8/B4vibfp1MvTi1mIj2Xo=",
	},
} as const;
