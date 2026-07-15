/**
 * The shared UAT (test-environment) API keypair.
 *
 * DELIBERATE: this keypair is public. It is published openly in llms.txt /
 * index.md (see `aiGettingStartedNotice` in lib/markdown/shared.ts) to give AI
 * agents a zero-signup trial, prefilled into the docs Try-it panel (see
 * `uatAuthentication` in lib/docs/tryit-client.ts), and shown on the developer
 * console — so it is inlined in the production client bundle. Treat it as a
 * public demo credential: scoped, quota'd, rotatable — NEVER a secret. Do not
 * "fix" any of those call sites by removing the keypair without checking that
 * intent, and never route a real secret through this module.
 *
 * Read via import.meta.env, NOT process.env: Vite loads .env files into
 * import.meta.env only, so process.env.VITE_* is always undefined here and once
 * published the literal string "undefined" as the test credentials.
 */

export type UatCredentials = {
	/** `developer_key` request parameter. */
	developerKey: string;
	/** `access_key` request parameter (the HMAC signing key, base64-encoded). */
	accessKey: string;
};

/**
 * The shared public UAT keypair, or null when it is not configured.
 *
 * Both-or-nothing: a half-configured build env yields null rather than serving a
 * blank half of a keypair as if it were a credential.
 */
export function uatCredentials(): UatCredentials | null {
	const developerKey = import.meta.env.VITE_EPS_UAT_DEVELOPER_KEY;
	const accessKey = import.meta.env.VITE_EPS_UAT_ACCESS_KEY;
	return developerKey && accessKey ? { developerKey, accessKey } : null;
}
