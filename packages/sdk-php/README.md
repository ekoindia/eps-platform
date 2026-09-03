# ekoindia/eps-sdk

> Published from a **read-only mirror** ([`ekoindia/eps-sdk-php`](https://github.com/ekoindia/eps-sdk-php)),
> subtree-split from the monorepo. Source of truth, issues and PRs:
> [`ekoindia/eps-platform` → `packages/sdk-php`](https://github.com/ekoindia/eps-platform/tree/main/packages/sdk-php).

Backend-only PHP SDK for Eko Platform Services (EPS) APIs, with HMAC request signing baked in.

## ⚠️ BACKEND-ONLY — never run in a frontend

This SDK requires your EPS `access_key`, which is a **server-side secret**. The SDK uses it to compute the per-request signature:

```
secret-key = base64(HMAC-SHA256(timestamp_ms, base64(access_key)))
```

If the `access_key` ever leaves your server, it is compromised. **Only ever construct `EpsClient` in server-side PHP** — never expose the `access_key` to a browser or client device.

## Install

```bash
composer require ekoindia/eps-sdk
```

Requires PHP >= 8.1, with `ext-curl` and `ext-json`. No other dependencies.

### What it does for you

- **Signs the request** — `secret-key`, `secret-key-timestamp` and `developer_key` headers on every call.
- **Validates first** — missing required params and wrong types throw `\InvalidArgumentException` before a request goes out.
- **Routes the params** — path tokens, query string, JSON body, or `multipart/form-data` for file-upload endpoints, per the endpoint's spec.
- **Fails loudly** — a non-2xx response throws `Eko\Eps\EpsHttpException` (with the decoded envelope on `->body`); a non-JSON body throws rather than returning `[]`.
- **Never loses a transaction** — every non-GET call carries a `client_ref_id` (yours, or a generated 15-char one). A money-moving call that times out is looked up by that ref and surfaced as `Eko\Eps\EpsIndeterminateException` with the inquiry result attached, never silently re-sent.
- **Retries the safe things** — a GET that times out or gets a 429/5xx is retried with jittered backoff (`$retries`, default 2); non-GET calls are never re-sent.
- **Validates values too** — spec-driven format / enum / range / length rules (dates, PAN, IFSC, `client_ref_id` …) fail before the request is signed.

### Reconciling an indeterminate transaction

```php
use Eko\Eps\EpsIndeterminateException;

try {
    $client->call('bbps-pay-bill', [/* … */]);
} catch (EpsIndeterminateException $e) {
    // $e->clientRefId — persist it; $e->statusCheck['data']['tx_status']:
    // "0" success, "1" fail, "2" awaited. Inquire again later with
    // $client->call('transaction-inquiry', ['transaction-reference' => "client_ref_id:{$e->clientRefId}"]);
}
```

Knobs: `retries` (2), `retryBaseDelay` (0.2 s), `autoStatusCheck` (true). A
transport failure throws `Eko\Eps\EpsTransportException`.

## Usage

```php
<?php
use Eko\Eps\EpsClient;

$client = new EpsClient(
    developerKey: getenv('EPS_DEVELOPER_KEY'),
    accessKey: getenv('EPS_ACCESS_KEY'), // server-side secret
    initiatorId: '9962981729',           // your registered mobile; injected into every call
    environment: 'sandbox'               // or 'production'
);

// Call an endpoint by its slug; params fill path tokens and the request body.
// initiator_id / user_code are supplied from the client config above.
$result = $client->call('dmt-get-sender', [
    'customer_id' => '9123456789',
]);

print_r($result);
```

`new EpsClient($developerKey, $accessKey, $environment, $initiatorId, $userCode, $timeout)` selects
the base URL from the embedded catalog based on `$environment` (`'sandbox'` or
`'production'`). Use named arguments as shown above.

`$timeout` is the whole-request budget in **seconds** (default `30.0`). A
non-positive or non-finite value is rejected at construction.

`$initiatorId` / `$userCode` are near-constant per developer, so set them once on the
client. They are injected into every call as the wire params `initiator_id` / `user_code`
(note the snake_case wire names) — override either for a single call by passing it in
`$params`.

`$client->call($slug, $params)` signs the request, substitutes any `{token}` path params
from `$params` (remaining keys become the JSON body — or a `multipart/form-data` body on
file-upload endpoints), and returns the decoded JSON response as an associative array.

A non-2xx response throws `Eko\Eps\EpsHttpException` — an auth or
infrastructure failure is never returned as if it were a result:

```php
use Eko\Eps\EpsHttpException;

try {
    $result = $client->call('pan-lite', [/* … */]);
} catch (EpsHttpException $e) {
    error_log("HTTP {$e->status}");
    print_r($e->body); // decoded envelope, or null when the body was not JSON
}
```

A 2xx body that is not JSON throws `Eko\Eps\EpsException` — never a silent
`[]`. Input validation keeps SPL's `\InvalidArgumentException`, which is a
`\LogicException` and therefore cannot share that base. The contract is shared
by all five EPS SDKs; see
[docs/sdk-golden-vector.md](../../docs/sdk-golden-vector.md).

### File uploads

Endpoints with file params (e.g. `activate-aeps-fingpay`) are sent as `multipart/form-data`
automatically. Pass each file param as a path to an existing file (wrapped in a `CURLFile`
for you) or a `CURLFile` directly:

```php
$result = $client->call('activate-aeps-fingpay', [
    'user_code' => '20810200',
    'modelname' => 'Morpho 1300E3',
    'devicenumber' => 'SN1234567890',
    'account' => '38759149196',
    'ifsc' => 'SBIN0007515',
    'office_address' => ['line' => 'Shop 5', 'city' => 'Patna', 'state' => 'Bihar', 'pincode' => '800001'],
    'address_as_per_proof' => ['line' => 'Shop 5', 'city' => 'Patna', 'state' => 'Bihar', 'pincode' => '800001'],
    'pan_card' => '/path/to/pan_card.jpg',                  // path string…
    'aadhar_front' => new \CURLFile('/path/to/front.jpg'),  // …or a CURLFile
    'aadhar_back' => '/path/to/back.jpg',
]);
```

You still pass every parameter flat, as above. On the wire the SDK packs them the way the
API expects: **one form field named `form-data` holding all the non-file params as a single
JSON object** (arrays like `office_address` stay nested), plus one part per upload. A `null`
param is dropped — a form field has no null encoding — while a `null` inside an array value
is preserved. A value that cannot be JSON-encoded raises a `\JsonException` rather than
silently blanking the payload. cURL sets the `content-type` header (and multipart boundary)
itself.

A static `EpsClient::signSecretKey($accessKey, $timestamp)` helper is also available if you
need to sign requests yourself.

## Endpoint catalog

The embedded endpoint catalog (slugs, methods, paths, required params) is generated from the
EPS bundle at `/agent/sdk-surface.json` and shipped as `data/sdk-surface.json`. It is read at
runtime — no network call is needed to resolve a slug.

## Upgrading to 2.0

`call()` used to return `json_decode($res, true) ?? []` whatever the HTTP status,
so a `403` envelope looked like a result and a non-JSON body silently became an
empty array. It now throws.

```php
// 1.x — an error envelope was indistinguishable from success
$result = $client->call($slug, $params);
if (($result['status'] ?? null) !== 0) handleFailure($result);

// 2.x
use Eko\Eps\EpsHttpException;
try {
    $result = $client->call($slug, $params);
} catch (EpsHttpException $e) {
    handleFailure($e->body, $e->status);
}
```

Also new in 2.0: a `$timeout` constructor parameter (30s default) applied via
`CURLOPT_TIMEOUT_MS`, a transport failure throws `Eko\Eps\EpsException` instead
of decoding `false`, and the surface-load failures now throw `EpsException`
(a `\RuntimeException` subclass, so existing catches still match).
