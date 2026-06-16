/**
 * Scalar API-client plugin that signs each outgoing sandbox request with Eko's
 * per-request HMAC, reusing the documented browser scheme in `eko-signing.ts`.
 *
 * `developer_key` and `access_key` are modeled as apiKey header security schemes,
 * so the modal renders auth fields for them. At `beforeRequest` time those values
 * live in `requestBuilder.security` (resolved scheme values) — they are NOT yet on
 * `requestBuilder.headers`; the client applies security headers later, in
 * `buildRequest`. So we follow Scalar's documented custom-auth pattern:
 *
 *   • read both keys from `requestBuilder.security`;
 *   • set `options.disableSecurity` so `buildRequest` does NOT add the raw
 *     `access_key` (or `developer_key`) header itself;
 *   • set `developer_key` + the computed `secret-key` / `secret-key-timestamp`
 *     headers ourselves, and never write `access_key`.
 *
 * Net effect: the raw `access_key` is used only to compute the signature locally
 * and is never transmitted — only the signature leaves the browser.
 */
import type { ClientPlugin } from "@scalar/oas-utils/helpers";

import { computeSecretKey } from "@/lib/docs/eko-signing";

export const ekoSigningPlugin: ClientPlugin = {
	hooks: {
		beforeRequest: async ({ requestBuilder }) => {
			const headerValue = (name: string): string | undefined =>
				(requestBuilder.security ?? []).find(
					(scheme) => scheme.in === "header" && scheme.name === name,
				)?.value;

			const accessKey = headerValue("access_key");
			if (!accessKey) return; // nothing to sign — leave the request untouched

			// Take over security handling so the built-in builder does not add the
			// raw access_key (or developer_key) header.
			requestBuilder.options = {
				...requestBuilder.options,
				disableSecurity: true,
			};

			const developerKey = headerValue("developer_key");
			if (developerKey)
				requestBuilder.headers.set("developer_key", developerKey);

			const timestamp = String(Date.now());
			requestBuilder.headers.set(
				"secret-key",
				await computeSecretKey(accessKey, timestamp),
			);
			requestBuilder.headers.set("secret-key-timestamp", timestamp);
			// access_key intentionally never written to the request headers.
		},
	},
};
