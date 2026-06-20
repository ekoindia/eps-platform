# "Try It Now" Console & Request Signing

Each endpoint page has a **Test Request** button that opens the **Scalar API-client
modal** scoped to that operation. The user supplies UAT credentials in the modal's
auth panel; each request is signed **locally** with Web Crypto (an Eko HMAC plugin)
and routed through a **CORS proxy** to the sandbox. The raw `access_key` never leaves
the browser — only the derived signature is sent.

This replaced an earlier hand-rolled in-browser console (`TryItPanel`) that did a
direct `fetch()` and hit CORS. The cURL/JS/Python code samples remain as the
copy-and-run fallback.

## Components

- **`src/components/docs/CodeSamples.tsx`** — renders the right-rail code samples and
  the "Test Request" button; calls `onTest(path, method)`.
- **`src/components/docs/useTryIt.ts`** — hook returning `onTest`; **dynamically
  imports** the Scalar client on first click so it never enters the SSR/prerender
  bundle (no-op on the server).
- **`src/lib/docs/tryit-client.ts`** — client-only singleton that creates the Scalar
  modal (`createApiClientModal` from `@scalar/api-client/modal` + `@scalar/workspace-store`),
  registers the interactive OpenAPI doc, and exposes `openTryIt(path, method)`.
- **`src/lib/docs/eko-signing-plugin.ts`** — the `ClientPlugin` (`beforeRequest` hook)
  that signs each request.
- **`src/lib/docs/eko-signing.ts`** — Web Crypto HMAC-SHA256 signing (reused by the
  plugin; unchanged from the old console).
- **`src/lib/docs/tryit-proxy.ts`** — resolves the CORS proxy URL.
- **`src/lib/openapi/build-openapi.ts`** — `{ interactive: true }` builds the
  Scalar-tuned spec (auth schemes; signing headers dropped).

## Why the lower-level client (not `@scalar/api-client-react`)

The react wrapper's `useApiClient` does **not** forward `plugins`, and this version of
the client does **not** execute `x-pre-request` scripts in its send path. Signing must
therefore happen in a `beforeRequest` **plugin**, which only `createApiClientModal`
accepts — so `tryit-client.ts` mirrors what the react wrapper does internally but adds
`plugins: [ekoSigningPlugin]`. Direct deps: `@scalar/api-client`,
`@scalar/workspace-store`, `@scalar/oas-utils` (the react wrapper is not used).

## Credentials

`developer_key` and `access_key` are modeled as `apiKey` **header** security schemes in
the interactive OpenAPI doc, so the modal renders auth fields for them. In **DEV only**
they are prefilled from `VITE_EPS_UAT_DEVELOPER_KEY` / `VITE_EPS_UAT_ACCESS_KEY` via
`authentication.securitySchemes` (gated by `import.meta.env.DEV`, which is false during
the Node prerender and in production — so creds never reach static output).

## Client-side HMAC signing (the plugin)

`eko-signing.ts` reproduces Eko's scheme with Web Crypto:

```
secret-key = base64( HMAC-SHA256( timestamp, base64(access_key) ) )
```

The plugin runs in `beforeRequest` — **after** the auth schemes have populated the
`developer_key` / `access_key` headers and **immediately before** the request is built,
so the `access_key` delete is deterministic:

```typescript
// src/lib/docs/eko-signing-plugin.ts
export const ekoSigningPlugin: ClientPlugin = {
	hooks: {
		beforeRequest: async ({ requestBuilder }) => {
			const { headers } = requestBuilder; // standard Headers
			const accessKey = headers.get("access_key");
			if (!accessKey) return;
			const timestamp = String(Date.now());
			headers.set("secret-key", await computeSecretKey(accessKey, timestamp));
			headers.set("secret-key-timestamp", timestamp);
			headers.delete("access_key"); // never sent — only the signature leaves
		},
	},
};
```

`developer_key` passes through unchanged.

## Interactive OpenAPI doc vs. the public `/openapi.json`

The public `openapi.json` (served/emitted by `vite-plugin-generate-openapi`) stays
**pristine and byte-stable**: no security schemes, signing headers modeled as required
header parameters. The modal instead consumes `buildOpenApiDocument(specs, { interactive:
true })`, which:

- adds `components.securitySchemes.developerKey` / `.accessKey` (`apiKey`, in `header`);
- sets per-operation `security: [{ developerKey: [], accessKey: [] }]`;
- drops `developer_key` / `secret-key` / `secret-key-timestamp` from operation params
  (schemes + plugin supply them), and `content-type` when a JSON body exists.

The interactive doc is built lazily on first "Test Request" click (inside the async
`tryit-client` chunk), so the 342 KB spec layer is not shipped on initial docs load.

## CORS proxy

`resolveTryItProxyUrl()` reads `VITE_SCALAR_PROXY_URL`:

- **unset** → Scalar's hosted proxy `https://proxy.scalar.com` (default);
- `"<url>"` → that proxy (e.g. a self-hosted one);
- `""` (blank) → proxy disabled (direct request; will likely fail CORS).

## Security framing (honest)

This is a **UAT/sandbox** console. With the hosted proxy, the `developer_key`, computed
`secret-key`, timestamp, URL, request body, and responses transit a third party
(Scalar). That is acceptable for sandbox traffic and is the trade-off for solving CORS.
The raw `access_key` is never transmitted — it is only the HMAC key, consumed in-browser
and stripped before send. Blank `VITE_SCALAR_PROXY_URL` for zero third-party transit
(CORS then applies).

## SSG safety

`DocDetailPage` is prerendered by `AppServer.tsx`. The Scalar client (Vue app + CSS) is
loaded only via the dynamic `import("@/lib/docs/tryit-client")` inside `useTryIt`'s
callback, so it stays out of the server module graph and out of the initial client
bundle — verified: prerendered HTML contains no Scalar markup, and the build emits
`tryit-client-*.js` as a separate async chunk.
