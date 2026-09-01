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

Requires PHP >= 8.1.

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

`new EpsClient($developerKey, $accessKey, $environment, $initiatorId, $userCode)` selects
the base URL from the embedded catalog based on `$environment` (`'sandbox'` or
`'production'`). Use named arguments as shown above.

`$initiatorId` / `$userCode` are near-constant per developer, so set them once on the
client. They are injected into every call as the wire params `initiator_id` / `user_code`
(note the snake_case wire names) — override either for a single call by passing it in
`$params`.

`$client->call($slug, $params)` signs the request, substitutes any `{token}` path params
from `$params` (remaining keys become the JSON body — or a `multipart/form-data` body on
file-upload endpoints), and returns the decoded JSON response as an associative array.

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
