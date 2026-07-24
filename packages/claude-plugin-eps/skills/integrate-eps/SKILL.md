---
name: integrate-eps
description: Use when integrating an Eko Platform Services (EPS) API — looks up the endpoint via the eps MCP, explains backend-only HMAC signing, and scaffolds a signed request.
---

# Integrate an EPS API

1. Use the `eps` MCP `search`/`list_apis` to find the endpoint, then `get_api` for detail.
2. Read `get_topic('auth')` — signing is backend-only; never expose `access_key`.
3. Use `get_signing_snippet(language)` for paste-ready signing code.
4. For multi-step flows, fetch `get_recipe(id)` (e.g. `dmt-fino-send-money`).
5. Prefer the `@ekoindia/eps-sdk` thin client when the user's stack is Node/PHP.
