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
    environment: 'sandbox'               // or 'production'
);

// Call an endpoint by its slug; params fill path tokens and the request body.
$result = $client->call('dmt-get-sender', [
    'mobile' => '9999999999',
]);

print_r($result);
```

`new EpsClient($developerKey, $accessKey, $environment)` selects the base URL from the
embedded catalog based on `$environment` (`'sandbox'` or `'production'`).

`$client->call($slug, $params)` signs the request, substitutes any `{token}` path params
from `$params` (remaining keys become the JSON body), and returns the decoded JSON response
as an associative array.

A static `EpsClient::signSecretKey($accessKey, $timestamp)` helper is also available if you
need to sign requests yourself.

## Endpoint catalog

The embedded endpoint catalog (slugs, methods, paths, required params) is generated from the
EPS bundle at `/agent/sdk-surface.json` and shipped as `data/sdk-surface.json`. It is read at
runtime — no network call is needed to resolve a slug.
