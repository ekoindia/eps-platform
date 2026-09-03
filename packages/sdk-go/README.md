# EPS Go SDK

Backend-only Go client for [Eko Platform Services](https://eps.eko.in/docs/sdk/go)
APIs — DMT, AePS, BBPS, KYC and verification — with HMAC request signing built
in.

```bash
go get github.com/ekoindia/eps-sdk-go
```

```go
package main

import (
	"context"
	"fmt"
	"log"
	"os"

	eps "github.com/ekoindia/eps-sdk-go"
)

func main() {
	client, err := eps.New(eps.Config{
		DeveloperKey: os.Getenv("EPS_DEVELOPER_KEY"),
		AccessKey:    os.Getenv("EPS_ACCESS_KEY"),
		InitiatorID:  "9962981729", // registered mobile of the API user
		UserCode:     "20810200",   // retailer/agent code
		Environment:  "sandbox",    // or "production"
	})
	if err != nil {
		log.Fatal(err)
	}

	sender, err := client.Call(context.Background(), "dmt-get-sender", map[string]any{
		"customer_id": "9123456789",
	})
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(sender)
}
```

One generic `Call(ctx, slug, params)` covers every endpoint. The slug list, each
endpoint's params and which of them are required all come from the same
generated API surface the docs are built from, so the client validates your
input **before** it signs and sends anything.

## Backend only

`AccessKey` signs every request. Never ship it to a client application — a
leaked access key lets anyone transact as you.

## What it does for you

- **Signs the request** — `secret-key`, `secret-key-timestamp` and
  `developer_key` headers on every call.
- **Validates first** — missing required params and wrong types return an error
  before a request goes out.
- **Routes the params** — path tokens, query string, JSON body, or
  `multipart/form-data` for file-upload endpoints, per the endpoint's spec.
- **Fails loudly** — a non-2xx response returns `*eps.HTTPError` (with the
  decoded envelope on `.Body`); a non-JSON body is an error, never an empty map.
- **Never loses a transaction** — every non-GET call carries a `client_ref_id` (yours, or a generated 15-char one). A money-moving call that times out is looked up by that ref and surfaced as `*eps.IndeterminateError` with the inquiry result attached, never silently re-sent.
- **Retries the safe things** — a GET that times out or gets a 429/5xx is retried with jittered backoff (`Config.Retries`, default 2); non-GET calls are never re-sent.
- **Validates values too** — spec-driven format / enum / range / length rules (dates, PAN, IFSC, `client_ref_id` …) fail before the request is signed.

Uploads take a path or in-memory bytes:

```go
client.Call(ctx, "activate-aeps-fingpay", map[string]any{
	"pan_card":     "/path/to/pan.jpg",
	"aadhar_front": eps.File{Name: "aadhar.jpg", Content: imageBytes},
	// ...
})
```

Pass `Config.HTTPClient` to control timeouts or proxies; the default is a
client with a 30s per-attempt timeout.

Reconciling an indeterminate transaction:

```go
_, err := client.Call(ctx, "bbps-pay-bill", params)
var ind *eps.IndeterminateError
if errors.As(err, &ind) {
	// ind.ClientRefID — persist it; ind.StatusCheck["data"].(map[string]any)["tx_status"]:
	// "0" success, "1" fail, "2" awaited. Inquire again later with
	// client.Call(ctx, "transaction-inquiry", map[string]any{"transaction-reference": "client_ref_id:" + ind.ClientRefID})
}
```

Knobs: `Config.Retries` (nil → 2), `Config.RetryBaseDelay` (0 → 200ms),
`Config.AutoStatusCheck` (nil → true). A transport failure is a
`*eps.TransportError` wrapping the native error.

## Zero dependencies

Standard library only. `go.mod` has no `require` block and there is no `go.sum`.

## Development

The embedded asset `data/sdk-surface.json` is generated from the API specs and
is **not** committed — and Go embeds it at compile time, so the package does not
build without it. From the repo root:

```bash
npm run build            # bakes packages/sdk-go/data/sdk-surface.json
cd packages/sdk-go
go test ./...
```

CI force-commits the baked file into the release mirror, so a `go get` consumer
always compiles against a present surface.

The test suite is the cross-language conformance suite described in
`docs/sdk-golden-vector.md` — the same cases the Node.js, PHP, Python and Java SDKs
must pass.

MIT licensed.
