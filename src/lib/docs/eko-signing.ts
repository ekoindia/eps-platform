/**
 * Browser-side request signing for the docs "Try it" console.
 *
 * Implements Eko's documented HMAC scheme (see `api-auth.ts` / How Auth Works)
 * entirely with Web Crypto, so the live console needs no backend: the user's
 * UAT `access_key` is used to sign in the browser and is never sent anywhere
 * except, indirectly, as the computed signature on the sandbox request.
 *
 *   secret-key = base64( HMAC-SHA256( timestamp, base64(access_key) ) )
 */

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

export interface SignedHeaders {
	developer_key: string;
	"secret-key": string;
	"secret-key-timestamp": string;
	"content-type": string;
}

/** Build the full signed header set for a request, signing at call time. */
export const buildSignedHeaders = async (
	creds: { developerKey: string; accessKey: string },
	now: number,
): Promise<SignedHeaders> => {
	const timestamp = String(now);
	return {
		developer_key: creds.developerKey,
		"secret-key": await computeSecretKey(creds.accessKey, timestamp),
		"secret-key-timestamp": timestamp,
		"content-type": "application/json",
	};
};
