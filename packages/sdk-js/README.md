# @ekoindia/eps-sdk

Backend-only Node.js SDK for Eko Platform Services (EPS) APIs, with HMAC request signing baked in.

## ⚠️ BACKEND-ONLY — never run in a browser

This SDK requires your EPS `access_key`, which is a **server-side secret**. The SDK uses it to compute the per-request signature:

```
secret-key = base64(HMAC-SHA256(timestamp_ms, base64(access_key)))
```

If the `access_key` ever reaches a browser, frontend bundle, or any client device, it is compromised. **Never instantiate `EpsClient` in a browser or ship it to the frontend.** The constructor throws if it detects a `window` global as a safety guard, but you are still responsible for keeping the key on the server.

## Install

```bash
npm install @ekoindia/eps-sdk
```

Requires Node.js >= 18.

## Usage

```js
import { EpsClient } from "@ekoindia/eps-sdk";

const client = new EpsClient({
	developerKey: process.env.EPS_DEVELOPER_KEY,
	accessKey: process.env.EPS_ACCESS_KEY, // server-side secret
	environment: "sandbox", // or "production"
});

// Call an endpoint by its slug; params fill path tokens and the request body.
const result = await client.call("dmt-get-sender", {
	mobile: "9999999999",
});

console.log(result);
```

`new EpsClient(options)` accepts:

| Option         | Type                          | Notes                                       |
| -------------- | ----------------------------- | ------------------------------------------- |
| `developerKey` | `string`                      | Your EPS developer key.                     |
| `accessKey`    | `string`                      | Server-side secret used for signing.        |
| `environment`  | `"sandbox" \| "production"`   | Selects the base URL.                       |
| `fetch`        | `typeof fetch` (optional)     | Inject a custom fetch implementation.       |
| `now`          | `() => number` (optional)     | Inject a clock (returns timestamp in ms).   |

`await client.call(slug, params)` signs the request, substitutes any `{token}` path params from `params` (remaining keys become the JSON body), and returns the parsed JSON response.

A standalone `signSecretKey(accessKey, timestamp)` helper is also exported if you need to sign requests yourself.

## Endpoint catalog

The embedded endpoint catalog (slugs, methods, paths, required params) is generated from the EPS bundle at `/agent/sdk-surface.json` and shipped as `data/sdk-surface.json`. It is read at runtime — no network call is needed to resolve a slug.
