/**
 * Shared error / status code reference for Eko's REST APIs.
 *
 * These codes are stable and reused across all APIs, so they are stored ONCE
 * here. Individual {@link ApiSpec} entries reference codes by value (e.g. in
 * `errorScenarios`) and do not re-list this table. Rich enough to power a
 * developer portal "Error codes" page.
 *
 * Source: https://eps.eko.in/docs/error-codes
 */

export const API_ERROR_CODES_DOCS_URL = "/docs/error-codes";

export interface ApiErrorCode {
	code: string | number;
	/** Where the code originates. */
	scope: "http" | "transaction";
	meaning: string;
}

/**
 * One `tx_status` value of the financial response envelope.
 *
 * Kept separate from {@link ApiErrorCode} on purpose: `tx_status` is a
 * transaction *state*, not an error code, and the agent bundle's `errors` topic
 * (consumed by both MCP packages with a closed `scope` union) must not pick it
 * up by accident. Flows into every envelope / endpoint description via
 * {@link txStatusSummary} so the enum is written exactly once.
 */
export interface TxStatusCode {
	code: number;
	meaning: string;
}

/**
 * `tx_status` values.
 */
export const TX_STATUS_CODES: TxStatusCode[] = [
	{ code: 0, meaning: "Success" },
	{ code: 1, meaning: "Fail" },
	{
		code: 2,
		meaning: "Initiated / Response Awaited (NEFT) — poll Transaction Inquiry",
	},
	{ code: 3, meaning: "Refund Pending" },
	{ code: 4, meaning: "Refunded" },
	{
		code: 6,
		meaning: "Response Awaited — Transaction Inquiry required",
	},
];

/**
 * One-line `tx_status` legend for field descriptions, e.g.
 * `0=Success, 1=Fail, …, 6=Response Awaited — Transaction Inquiry required`.
 */
export const txStatusSummary = (): string =>
	TX_STATUS_CODES.map((c) => `${c.code}=${c.meaning}`).join(", ");

/** Transport-level HTTP status codes. */
export const HTTP_STATUS_CODES: ApiErrorCode[] = [
	{
		code: 200,
		scope: "http",
		meaning: "OK — response returned by our system.",
	},
	{
		code: 401,
		scope: "http",
		meaning:
			"Unauthorized — authentication failed. Known causes are reported in the body status (2483–2487).",
	},
	{ code: 404, scope: "http", meaning: "Not Found — wrong request URL." },
	{
		code: 405,
		scope: "http",
		meaning: "Method Not Allowed — incorrect HTTP method.",
	},
	{
		code: 415,
		scope: "http",
		meaning: "Unsupported Media Type — wrong Content-Type header.",
	},
	{
		code: 500,
		scope: "http",
		meaning: "Internal Server Error — connectivity or URL misconfiguration.",
	},
];

/**
 * Business-level `status` codes (the envelope's primary outcome field; `0` =
 * success). NOT `response_status_id` — that field is a UI display hint only
 * (see /docs/error-codes). The export name predates that clarification.
 */
export const RESPONSE_STATUS_CODES: ApiErrorCode[] = [
	{ code: 0, scope: "transaction", meaning: "Success." },
	{ code: 17, scope: "transaction", meaning: "User wallet already exists." },
	{
		code: 132,
		scope: "transaction",
		meaning: "Sender name should only contain letters.",
	},
	{ code: 302, scope: "transaction", meaning: "Wrong OTP." },
	{ code: 303, scope: "transaction", meaning: "OTP expired." },
	{
		code: 319,
		scope: "transaction",
		meaning: "Invalid initiator_id — user does not exist in our system.",
	},
	{
		code: 327,
		scope: "transaction",
		meaning: "Enrollment done; verification pending.",
	},
	{
		code: 342,
		scope: "transaction",
		meaning: "Recipient already registered.",
	},
	{
		code: 346,
		scope: "transaction",
		meaning: "User/agent not onboarded, or wrong user_code.",
	},
	{ code: 347, scope: "transaction", meaning: "Insufficient balance." },
	{ code: 463, scope: "transaction", meaning: "User not found." },
	{
		code: 585,
		scope: "transaction",
		meaning: "Customer already KYC approved.",
	},
	{
		code: 945,
		scope: "transaction",
		meaning: "Sender/beneficiary monthly limit exhausted.",
	},
	{ code: 1297, scope: "transaction", meaning: "User/agent not onboarded." },
];

/** One authentication failure: an HTTP `401` whose body `status` names the cause. */
export interface AuthErrorCode {
	/** Body `status`; `response_type_id` carries the same value. */
	status: number;
	/** The body `message`, verbatim. */
	message: string;
	cause: string;
	fix: string;
}

/**
 * Known HTTP `401` body codes. The body is
 * `{ message, status, response_type_id: status, response_status_id: 1 }`.
 * Not exhaustive: an IP that is not allowlisted, an inactive key, or a UAT/prod
 * key mix-up is not confirmed to map to any of these.
 *
 * Keep in sync with the "Authentication errors" table in
 * `src/content/docs/error-codes.mdx` (guarded by `api-error-codes.test.ts`).
 */
export const AUTH_ERROR_CODES: AuthErrorCode[] = [
	{
		status: 2483,
		message: "Unauthorized",
		cause: "The developer_key is wrong",
		fix: "Send the developer_key for the environment you are calling, in the developer_key header.",
	},
	{
		status: 2484,
		message: "Invalid secret-key or timestamp",
		cause: "The secret-key (signature) is wrong",
		fix: "Sign the exact timestamp you send, keyed by base64(access_key) used as a string. Check your code against the secret-key playground.",
	},
	{
		status: 2485,
		message:
			"Expired security headers (secret-key-timestamp older than 2 minutes)",
		cause:
			"The secret-key-timestamp is more than 2 minutes older or newer than the server clock, or was reused from an earlier request",
		fix: "Generate a new timestamp and secret-key for every request, and keep the server clock synced (NTP).",
	},
	{
		status: 2486,
		message:
			"Invalid secret-key-timestamp (expected milliseconds since the UNIX epoch)",
		cause:
			"The secret-key-timestamp is not in milliseconds (13 digits) — often seconds (10 digits)",
		fix: "Send milliseconds since the UNIX epoch, e.g. Date.now() in JavaScript or int(time.time() * 1000) in Python.",
	},
	{
		status: 2487,
		message: "Missing security headers",
		cause: "The secret-key or secret-key-timestamp header is missing",
		fix: "Send both headers, spelled exactly secret-key and secret-key-timestamp.",
	},
];

/** All known codes, for convenient lookup/rendering. */
export const ALL_ERROR_CODES: ApiErrorCode[] = [
	...HTTP_STATUS_CODES,
	...RESPONSE_STATUS_CODES,
	// Body codes of an HTTP 401. Scope stays "transaction" (a body `status`) so
	// the MCP packages' closed `scope` union needs no change.
	...AUTH_ERROR_CODES.map(
		(c): ApiErrorCode => ({
			code: c.status,
			scope: "transaction",
			meaning: `HTTP 401 — ${c.cause}. ${c.fix}`,
		}),
	),
];

/** Look up a code's meaning across both scopes. */
export const getErrorCodeMeaning = (
	code: string | number,
): string | undefined =>
	ALL_ERROR_CODES.find((c) => String(c.code) === String(code))?.meaning;
