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

Requires Node.js >= 18. No runtime dependencies — standard library only.

### What it does for you

- **Signs the request** — `secret-key`, `secret-key-timestamp` and `developer_key` headers on every call.
- **Validates first** — missing required params and wrong types throw `EpsError` before a request goes out.
- **Routes the params** — path tokens, query string, JSON body, or `multipart/form-data` for file-upload endpoints, per the endpoint's spec.
- **Fails loudly** — a non-2xx response throws `EpsHttpError` (with the decoded envelope on `.body`); a non-JSON body throws rather than returning `{}`.
- **Never loses a transaction** — every non-GET call carries a `client_ref_id` (yours, or a generated 15-char one). A money-moving call that times out is looked up by that ref and surfaced as `EpsIndeterminateError` with the inquiry result attached, never silently re-sent.
- **Retries the safe things** — a GET that times out or gets a 429/5xx is retried with jittered backoff (`retries`, default 2); non-GET calls are never re-sent.
- **Validates values too** — spec-driven format / enum / range / length rules (dates, PAN, IFSC, `client_ref_id` …) fail before the request is signed.

### Reconciling an indeterminate transaction

```ts
import { EpsClient, EpsIndeterminateError } from "@ekoindia/eps-sdk";

try {
	await client.call("bbps-pay-bill", { /* … */ });
} catch (err) {
	if (err instanceof EpsIndeterminateError) {
		// err.clientRefId — persist it; err.statusCheck?.data.tx_status:
		// "0" success, "1" fail, "2" awaited. Inquire again later with
		// client.call("transaction-inquiry", { "transaction-reference": `client_ref_id:${err.clientRefId}` })
	}
}
```

Knobs: `retries` (2), `retryBaseDelayMs` (200), `autoStatusCheck` (true).

## Usage

```js
import { EpsClient } from "@ekoindia/eps-sdk";

const client = new EpsClient({
	developerKey: process.env.EPS_DEVELOPER_KEY,
	accessKey: process.env.EPS_ACCESS_KEY, // server-side secret
	initiatorId: "9962981729", // your registered mobile; injected into every call
	environment: "sandbox", // or "production"
});

// Call an endpoint by its slug; params fill path tokens and the request body.
// initiator_id / user_code are supplied from the client config above.
const result = await client.call("dmt-get-sender", {
	customer_id: "9123456789",
});

console.log(result);
```

`new EpsClient(options)` accepts:

| Option         | Type                          | Notes                                                          |
| -------------- | ----------------------------- | -------------------------------------------------------------- |
| `developerKey` | `string`                      | Your EPS developer key.                                        |
| `accessKey`    | `string`                      | Server-side secret used for signing.                           |
| `initiatorId`  | `string` (optional)           | Default `initiator_id` injected into every call.               |
| `userCode`     | `string` (optional)           | Default `user_code` injected into every call.                  |
| `environment`  | `"sandbox" \| "production"`   | Selects the base URL.                                          |
| `fetch`        | `typeof fetch` (optional)     | Inject a custom fetch implementation.                          |
| `timeoutMs`    | `number` (optional)           | Abort a request after this many **milliseconds**. Default `30_000`. |
| `now`          | `() => number` (optional)     | Inject a clock (returns timestamp in ms).                      |

`await client.call(slug, params)` signs the request, substitutes any `{token}` path params from `params` (remaining keys become the JSON body — or a `multipart/form-data` body on file-upload endpoints), and returns the parsed JSON response.

A non-2xx response throws `EpsHttpError` — an auth or infrastructure failure is
never returned as if it were a result:

```js
import { EpsHttpError } from "@ekoindia/eps-sdk";

try {
	const result = await client.call("pan-lite", { /* … */ });
} catch (err) {
	if (err instanceof EpsHttpError) {
		console.error(err.status, err.body); // decoded envelope, when the body was JSON
	}
	throw err;
}
```

Every other client-side failure (unknown slug, missing param, wrong type, bad
option) throws `EpsError`, which `EpsHttpError` extends. A 2xx body that is not
JSON throws too — never a silent `{}`. The contract is shared by all five EPS
SDKs; see [docs/sdk-golden-vector.md](../../docs/sdk-golden-vector.md).

### File uploads

Endpoints with file params (e.g. `activate-aeps-fingpay`) are sent as `multipart/form-data` automatically. Pass each file param as a local file path (read from disk, filename = basename) or a `Blob`/`File`:

```js
import { openAsBlob } from "node:fs"; // only needed for the Blob variant

const result = await client.call("activate-aeps-fingpay", {
	user_code: "20810200",
	modelname: "Morpho 1300E3",
	devicenumber: "SN1234567890",
	account: "38759149196",
	ifsc: "SBIN0007515",
	office_address: { line: "Shop 5", city: "Patna", state: "Bihar", pincode: "800001" },
	address_as_per_proof: { line: "Shop 5", city: "Patna", state: "Bihar", pincode: "800001" },
	pan_card: "/path/to/pan_card.jpg", // path string…
	aadhar_front: await openAsBlob("/path/to/aadhar_front.jpg"), // …or a Blob/File
	aadhar_back: "/path/to/aadhar_back.jpg",
});
```

You still pass every parameter flat, as above. On the wire the SDK packs them the way the API expects: **one form field named `form-data` holding all the non-file params as a single JSON object** (objects like `office_address` stay nested), plus one part per upload. A `null` param is dropped — a form field has no null encoding — while a `null` inside an object value is preserved. The `content-type` header (and multipart boundary) is set by `fetch` itself.

`initiatorId` / `userCode` are near-constant per developer, so set them once on the client. They are injected into every call as the wire params `initiator_id` / `user_code` (note the snake_case wire names) — override either for a single call by passing it in `params`.

A standalone `signSecretKey(accessKey, timestamp)` helper is also exported if you need to sign requests yourself.

## Upgrading to 2.0

`call()` used to return the response body whatever the HTTP status, so a `403`
or `500` envelope arrived looking like a successful result. It now throws.

```js
// 1.x — an error envelope was indistinguishable from success
const result = await client.call(slug, params);
if (result.status !== 0) handleFailure(result);

// 2.x
import { EpsHttpError } from "@ekoindia/eps-sdk";
try {
	const result = await client.call(slug, params);
} catch (err) {
	if (err instanceof EpsHttpError) handleFailure(err.body, err.status);
	else throw err;
}
```

Also new in 2.0: requests time out after 30s by default (`timeoutMs` to change
it), a 2xx body that is not JSON throws instead of surfacing as a parse error,
and `MULTIPART_JSON_FIELD` / the `SdkParam` type are exported.
