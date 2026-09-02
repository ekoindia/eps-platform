# EPS Python SDK

Backend-only Python client for [Eko Platform Services](https://eps.eko.in/docs)
APIs — DMT, AePS, BBPS, KYC and verification — with HMAC request signing built
in.

```bash
pip install eps-sdk
```

```python
from eps_sdk import EpsClient

client = EpsClient(
    developer_key="<your_developer_key>",
    access_key="<your_access_key>",
    environment="sandbox",      # or "production"
    initiator_id="9962981729",  # registered mobile of the API user
    user_code="20810200",       # retailer/agent code
    timeout=30.0,               # whole-request budget in seconds (default)
)

sender = client.call("dmt-get-sender", {"customer_id": "9123456789"})
```

One generic `call(slug, params)` covers every endpoint. The slug list, each
endpoint's params and which of them are required all come from the same
generated API surface the docs are built from, so the client validates your
input **before** it signs and sends anything.

`timeout` is the whole-request budget in **seconds**, defaulting to `30.0` — the
same 30s every EPS SDK defaults to. (Node names its knob `timeout_ms` /
`timeoutMs` because it is milliseconds there.) The response and error contract
is shared by all five SDKs; see
[docs/sdk-golden-vector.md](../../docs/sdk-golden-vector.md).

## Backend only

`access_key` signs every request. Never run this in anything a browser can
reach — a leaked access key lets anyone transact as you.

## What it does for you

- **Signs the request** — `secret-key`, `secret-key-timestamp` and
  `developer_key` headers on every call.
- **Validates first** — missing required params and wrong types raise `EpsError`
  before a request goes out.
- **Routes the params** — path tokens, query string, JSON body, or
  `multipart/form-data` for file-upload endpoints, per the endpoint's spec.
- **Fails loudly** — a non-2xx response raises `EpsHttpError` (with the decoded
  envelope on `.body`); a non-JSON body raises rather than returning `{}`.

Files can be a path or an in-memory pair:

```python
client.call("activate-aeps-fingpay", {
    "pan_card": "/path/to/pan.jpg",
    "aadhar_front": ("aadhar.jpg", image_bytes),
    # ...
})
```

## Zero dependencies

Standard library only (`urllib`, `hmac`, `json`). Nothing to keep patched.

## Development

The runtime asset `data/sdk-surface.json` is generated from the API specs, not
committed. From the repo root:

```bash
npm run build                            # bakes data/sdk-surface.json
cd packages/sdk-python
PYTHONPATH=src python3 -m unittest discover -s tests
```

The test suite is the cross-language conformance suite described in
`docs/sdk-golden-vector.md` — the same cases the Node.js and PHP SDKs must pass.

MIT licensed.
