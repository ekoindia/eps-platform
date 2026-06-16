# "Try It Now" Console & Request Signing

Each endpoint page has a **Test Request** button that opens an in-browser console.
The user supplies UAT credentials, the request is signed **locally** with Web
Crypto at send time, and the call goes **directly** to the sandbox — there is no
backend and **no proxy**. Credentials never leave the browser except as the
computed signature.

> **On the "proxy":** there is currently no proxy layer in this repo. The console
> does a direct `fetch()` from the browser to the sandbox host. See
> [Why there is no proxy](#why-there-is-no-proxy-and-the-cors-trade-off) below for
> the CORS trade-off and what a proxy would change.

## Components

- **`src/components/docs/TryItPanel.tsx`** — the console UI + send logic.
- **`src/components/docs/CodeSamples.tsx`** — hosts the "Test Request" button that
  opens the panel in a dialog.
- **`src/lib/docs/eko-signing.ts`** — Web Crypto HMAC-SHA256 signing.
- **`src/lib/docs/code-samples.ts`** — `resolveEndpointUrl()` builds the target URL.

## Credentials

The user enters `developer_key` and `access_key`. They are persisted to
`localStorage` under `eko-docs-uat-creds` for convenience, and in **DEV only**
prefilled from `VITE_EPS_UAT_DEVELOPER_KEY` / `VITE_EPS_UAT_ACCESS_KEY` (never
bundled into a production build):

```typescript
const CREDS_KEY = "eko-docs-uat-creds";
// prefill order: localStorage → import.meta.env.DEV env vars → empty
```

The `access_key` field is a password input; the UI states "Signed locally in your
browser; never sent anywhere except the sandbox."

## Client-side HMAC signing

`src/lib/docs/eko-signing.ts` reproduces Eko's auth scheme in the browser with the
Web Crypto API. The signing formula:

```
secret-key = base64( HMAC-SHA256( timestamp, base64(access_key) ) )
```

```typescript
const hmacSha256Base64 = async (message: string, keyString: string) => {
	const enc = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw", enc.encode(keyString),
		{ name: "HMAC", hash: "SHA-256" }, false, ["sign"],
	);
	const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
	return base64Bytes(sig);
};

export const computeSecretKey = (accessKey: string, timestamp: string) =>
	hmacSha256Base64(timestamp, base64Utf8(accessKey));

export const buildSignedHeaders = async (creds, now: number) => {
	const timestamp = String(now);
	return {
		developer_key: creds.developerKey,
		"secret-key": await computeSecretKey(creds.accessKey, timestamp),
		"secret-key-timestamp": timestamp,
		"content-type": "application/json",
	};
};
```

The header names exactly match `AUTH_HEADERS` from the single source of truth —
the static code samples show these same headers with placeholder values.

## End-to-end send flow

`TryItPanel.send()`:

1. Parse the editable request-body JSON (error out early if invalid).
2. `buildSignedHeaders(creds, Date.now())` — sign locally.
3. `resolveEndpointUrl(spec, body)` — substitute path params, prefix the sandbox
   base URL (`DEFAULT_BASE_URL`).
4. Direct `fetch(url, { method, headers, body: GET ? undefined : JSON.stringify(body) })`.
5. Pretty-print and display the status + response body.

```typescript
const headers = await buildSignedHeaders(creds, Date.now());
const url = resolveEndpointUrl(spec, body);
const res = await fetch(url, {
	method: spec.method,
	headers: headers as unknown as Record<string, string>,
	body: spec.method === "GET" ? undefined : JSON.stringify(body),
});
```

## Why there is no proxy (and the CORS trade-off)

The request goes browser → sandbox directly. There is **no** `api/` serverless
function, and `vercel.json` contains only SPA rewrites + static-asset/`.md`
headers — no API rewrite or edge proxy.

The trade-off is CORS: if the sandbox host doesn't return permissive CORS headers
for a browser origin, the `fetch` fails. The panel catches this and tells the user
to fall back to the generated cURL sample:

```typescript
error: `${(err as Error).message}. The sandbox may block direct browser requests
(CORS) — if so, copy the cURL sample and run it from your terminal.`,
```

**Security note — why direct signing is acceptable here:** this is a UAT/sandbox
console. The `access_key` is used only as the HMAC key inside the browser; only
the derived `secret-key` signature is transmitted, and only to the sandbox host.
The key itself is never sent anywhere.

**Incoming groundwork — `src/lib/docs/tryit-proxy.ts`.** An unwired helper now
exists for a Scalar-style CORS proxy: `resolveTryItProxyUrl()` returns Scalar's
hosted proxy (`https://proxy.scalar.com`) by default, overridable or disablable via
`VITE_SCALAR_PROXY_URL` (unset → hosted default; `"<url>"` → that proxy; `""` →
disabled/direct). It is **not yet imported** by `TryItPanel` or `CodeSamples`, so
current live behaviour is still the direct browser `fetch` described above. When
this gets wired in, routing requests through the proxy makes them same-origin and
removes the CORS limitation; update this doc at that point.
</content>
