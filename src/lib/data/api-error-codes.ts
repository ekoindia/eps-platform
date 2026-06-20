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

/** Transaction-level `response_status_id` codes. */
export const RESPONSE_STATUS_CODES: ApiErrorCode[] = [
	{ code: 0, scope: "transaction", meaning: "Success." },
	{ code: 17, scope: "transaction", meaning: "User wallet already exists." },
	{ code: 302, scope: "transaction", meaning: "Wrong OTP." },
	{ code: 303, scope: "transaction", meaning: "OTP expired." },
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
