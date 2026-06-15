/**
 * Browser-side request signing for the docs "Try it" console.
 *
 * Implements Eko's documented HMAC scheme (see `api-auth.ts` / How Auth Works)
 * entirely with Web Crypto, so the live console needs no backend: the user's
 * UAT `access_key` is used to sign in the browser and is never sent anywhere
 * except, indirectly, as the computed signature on the sandbox request.
 *
 *   secret-key   = base64( HMAC-SHA256( timestamp,            base64(access_key) ) )
 *   request_hash = base64( HMAC-SHA256( concatenated-params,  base64(access_key) ) )
 *
 * NOTE: `request_hash` is only emitted for endpoints that declare the exact
 * parameter order (`ApiSpec.requestHashParams`). The order + concatenation is
 * API-specific and unverified against a live call, so financial endpoints
 * without it must not be "sent" blindly.
 */
import type { ApiSpec } from "@/lib/data/api-specs-common";

/** base64 of a UTF-8 string (e.g. the access key). */
const base64Utf8 = (value: string): string =>
	btoa(unescape(encodeURIComponent(value)));

/** base64 of raw bytes. */
const base64Bytes = (buf: ArrayBuffer): string => {
	const bytes = new Uint8Array(buf);
	let binary = "";
	for (const b of bytes) binary += String.fromCharCode(b);
	return btoa(binary);
};

/** HMAC-SHA256(message) keyed by `keyString`, returned base64-encoded. */
const hmacSha256Base64 = async (
	message: string,
	keyString: string,
): Promise<string> => {
	const enc = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		enc.encode(keyString),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign("HMAC", key, enc.encode(message));
	return base64Bytes(signature);
};

/** Compute the `secret-key` for a given access key + millisecond timestamp. */
export const computeSecretKey = (
	accessKey: string,
	timestamp: string,
): Promise<string> => hmacSha256Base64(timestamp, base64Utf8(accessKey));

/**
 * Compute `request_hash` by concatenating the declared params (in order) from
 * the body and signing them. Returns null when the spec declares no order.
 */
export const computeRequestHash = async (
	spec: Pick<ApiSpec, "financial" | "requestHashParams">,
	body: Record<string, unknown>,
	accessKey: string,
): Promise<string | null> => {
	if (!spec.financial || !spec.requestHashParams?.length) return null;
	const concatenated = spec.requestHashParams
		.map((name) => String(body[name] ?? ""))
		.join("");
	return hmacSha256Base64(concatenated, base64Utf8(accessKey));
};

export interface SignedHeaders {
	developer_key: string;
	"secret-key": string;
	"secret-key-timestamp": string;
	"content-type": string;
	request_hash?: string;
}

/** Build the full signed header set for a request, signing at call time. */
export const buildSignedHeaders = async (
	spec: Pick<ApiSpec, "financial" | "requestHashParams">,
	creds: { developerKey: string; accessKey: string },
	body: Record<string, unknown>,
	now: number,
): Promise<SignedHeaders> => {
	const timestamp = String(now);
	const headers: SignedHeaders = {
		developer_key: creds.developerKey,
		"secret-key": await computeSecretKey(creds.accessKey, timestamp),
		"secret-key-timestamp": timestamp,
		"content-type": "application/json",
	};
	const requestHash = await computeRequestHash(spec, body, creds.accessKey);
	if (requestHash) headers.request_hash = requestHash;
	return headers;
};
