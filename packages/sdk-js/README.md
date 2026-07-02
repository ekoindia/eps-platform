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
| `now`          | `() => number` (optional)     | Inject a clock (returns timestamp in ms).                      |

`await client.call(slug, params)` signs the request, substitutes any `{token}` path params from `params` (remaining keys become the JSON body — or a `multipart/form-data` body on file-upload endpoints), and returns the parsed JSON response.

### File uploads

Endpoints with file params (e.g. `aeps-activate-fingpay`) are sent as `multipart/form-data` automatically. Pass each file param as a local file path (read from disk, filename = basename) or a `Blob`/`File`:

```js
import { openAsBlob } from "node:fs"; // only needed for the Blob variant

const result = await client.call("aeps-activate-fingpay", {
	user_code: "20810200",
	modelname: "Morpho 1300E3",
	devicenumber: "SN1234567890",
	office_address: { line: "Shop 5", city: "Patna", state: "Bihar", pincode: "800001" },
	address_as_per_proof: { line: "Shop 5", city: "Patna", state: "Bihar", pincode: "800001" },
	pan_card: "/path/to/pan_card.jpg", // path string…
	aadhar_front: await openAsBlob("/path/to/aadhar_front.jpg"), // …or a Blob/File
	aadhar_back: "/path/to/aadhar_back.jpg",
});
```

Object params (like `office_address`) are serialized as JSON form fields; the `content-type` header (and multipart boundary) is set by `fetch` itself.

`initiatorId` / `userCode` are near-constant per developer, so set them once on the client. They are injected into every call as the wire params `initiator_id` / `user_code` (note the snake_case wire names) — override either for a single call by passing it in `params`.

A standalone `signSecretKey(accessKey, timestamp)` helper is also exported if you need to sign requests yourself.
