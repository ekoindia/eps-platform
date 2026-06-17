---
name: sign-request
description: Use when computing or debugging the EPS secret-key / request signature — emits backend-only HMAC-SHA256 signing code and explains the header set.
---

# Sign an EPS request (backend only)

`secret-key = base64(HMAC-SHA256(timestamp_ms, base64(access_key)))`.
Headers: `developer_key`, `secret-key`, `secret-key-timestamp`, `content-type`.
Never compute this in a browser — `access_key` is a server-side secret.
Use the `eps` MCP `get_signing_snippet(language)` for the exact code.
