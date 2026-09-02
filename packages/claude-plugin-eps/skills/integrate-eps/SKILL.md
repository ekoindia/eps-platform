---
name: integrate-eps
description: Use when integrating an Eko Platform Services (EPS) API — looks up the endpoint via the eps MCP, explains backend-only HMAC signing, and scaffolds a signed request.
---

# Integrate an EPS API

1. Use the `eps` MCP `search`/`list_apis` to find the endpoint, then `get_api` for detail.
2. Check for an SDK before writing any HTTP: `list_sdks`, then `get_sdk(language)`.
   Node.js, Python, PHP, Go and Java all have one, and it signs, validates params
   and reports errors for you. Hand-write a signed request only when there is none.
3. Read `get_topic('auth')` — signing is backend-only; never expose `access_key`.
4. Use `get_signing_snippet(language)` for paste-ready signing code (languages with
   no SDK, or when debugging a 403).
5. For multi-step flows, fetch `get_recipe(id)` (e.g. `dmt-fino-send-money`).
