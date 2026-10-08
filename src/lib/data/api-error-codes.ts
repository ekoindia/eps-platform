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
		code: 403,
		scope: "http",
		meaning: "Forbidden — incorrect secret-key or timestamp.",
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

/** All known codes, for convenient lookup/rendering. */
export const ALL_ERROR_CODES: ApiErrorCode[] = [
	...HTTP_STATUS_CODES,
	...RESPONSE_STATUS_CODES,
];

/** Look up a code's meaning across both scopes. */
export const getErrorCodeMeaning = (
	code: string | number,
): string | undefined =>
	ALL_ERROR_CODES.find((c) => String(c.code) === String(code))?.meaning;
