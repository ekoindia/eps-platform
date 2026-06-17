/**
 * Shared authentication configuration for Eko's REST APIs.
 *
 * Every API call uses the same auth headers and signing scheme, so it is
 * defined ONCE here and referenced by every {@link ApiSpec} (via the resolvers
 * in `api-specs-common.ts`) instead of being duplicated per endpoint.
 *
 * Source: https://developers.eko.in/docs/auth
 */
import { API_DEFAULT_VERSION } from "@/lib/config/site";
import type { ApiParam } from "./api-specs-common";

/** Portal docs page describing the auth flow in full. */
export const API_AUTH_DOCS_URL = "https://developers.eko.in/docs/auth";

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
		note: "Self-serve credentials available immediately on signup.",
	},
	production: {
		label: "Production",
		baseUrl: `https://api.eko.in/ekoicici/${API_VERSION}`,
		note: "Credentials issued after organizational KYC at https://connect.eko.in.",
	},
};

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
} as const;
