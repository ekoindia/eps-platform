# ekoindia/eps-sdk

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
from `$params` (remaining keys become the JSON body), and returns the decoded JSON response
as an associative array.

A static `EpsClient::signSecretKey($accessKey, $timestamp)` helper is also available if you
need to sign requests yourself.

## Endpoint catalog

The embedded endpoint catalog (slugs, methods, paths, required params) is generated from the
EPS bundle at `/agent/sdk-surface.json` and shipped as `data/sdk-surface.json`. It is read at
runtime — no network call is needed to resolve a slug.
