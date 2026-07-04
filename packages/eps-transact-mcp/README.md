# @ekoindia/eps-transact-mcp

Transactional MCP server for **Eko Platform Services (EPS) verification APIs**. Unlike [`@ekoindia/eps-context-mcp`](../eps-context-mcp/) (documentation/context only), this server's tools **actually call** Eko — PAN, bank account, GST, driving licence, and every other verification endpoint, signed with your EPS credentials.

- **Registry-driven** — every tool is generated from the same single source of truth (`api-specs.ts` → `eps.json`) as the docs, SDKs, and context MCP. Verification-category, non-financial endpoints only.
- **Two modes** — remote (streamable HTTP, zero install) and local (stdio, zero credential sharing).
- **Nothing stored, nothing logged** — the remote server keeps no credentials, no request bodies, no responses. See [Data handling](#data-handling).

## Remote server (streamable HTTP)

Point any MCP client at the hosted endpoint and pass your EPS credentials as headers:

```sh
claude mcp add --transport http eps-transact https://mcp.eko.in/mcp \
  --header "X-Eko-Developer-Key: YOUR_DEVELOPER_KEY" \
  --header "X-Eko-Access-Key: YOUR_ACCESS_KEY" \
  --header "X-Eko-Allowed-Apis: eps_pan_lite,eps_bank_account_verification" \
  --header "X-Eko-Initiator-Id: YOUR_INITIATOR_ID"
```

### Headers

| Header                | Required | Meaning                                                                                                                           |
| --------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `X-Eko-Developer-Key` | yes      | Your static EPS developer key.                                                                                                    |
| `X-Eko-Access-Key`    | yes      | Your EPS access key; used to HMAC-sign each request server-side, never stored.                                                    |
| `X-Eko-Allowed-Apis`  | yes      | Comma-separated tool names your agents may call, or `*` for all verification tools. Deliberately required — EPS calls are billed. |
| `X-Eko-Env`           | no       | `uat` (default) or `production`. Production is explicit opt-in: real bills, real PII.                                             |
| `X-Eko-Initiator-Id`  | no       | Default `initiator_id` injected into every call (agents can override per call).                                                   |
| `X-Eko-User-Code`     | no       | Default `user_code`, same semantics.                                                                                              |

### Scoping is voluntary, not entitlement

`X-Eko-Allowed-Apis` restricts what **your** agents can invoke over **this** connection — a guardrail you configure in your MCP client, out of the model's reach. It is not an authorization system: your Eko credentials remain the real boundary of what your account can do. Treat the keys accordingly.

### UAT quickstart

Eko publishes a shared UAT `access_key` in the [auth docs](https://eps.eko.in/docs); UAT `developer_key` / `initiator_id` come from your Eko onboarding. With `X-Eko-Env` unset you are on UAT and can safely try:

> "Verify PAN ABCDE1234F for JOHN DOE, DOB 1990-01-01."

## Local server (stdio — zero credential sharing)

Credentials stay on your machine; calls go straight to Eko:

```sh
claude mcp add eps-transact \
  -e EKO_DEVELOPER_KEY=YOUR_DEVELOPER_KEY \
  -e EKO_ACCESS_KEY=YOUR_ACCESS_KEY \
  -e EKO_INITIATOR_ID=YOUR_INITIATOR_ID \
  -- npx -y @ekoindia/eps-transact-mcp@latest
```

Optional env: `EKO_ENV` (`uat` default | `production`), `EKO_ALLOWED_APIS` (defaults to `*` locally), `EKO_USER_CODE`.

## Staying up to date

- **Remote server** — nothing to do. It's hosted and auto-redeploys on every published update (its poller pulls the new `:prod`), so every client is instantly current. `GET /healthz` reports the live `bundleVersion`.
- **Local stdio** — the `@latest` in the install command re-resolves the newest published version on every launch, so `npx` always fetches current. `@latest` does a registry lookup at start; the server runs fully offline after that. Offline/air-gapped? Pin a version: `npx --offline -y @ekoindia/eps-transact-mcp@<version>`.
- **Update check** — on startup the stdio bin does one best-effort `GET registry.npmjs.org/@ekoindia/eps-transact-mcp/latest` (3s timeout, silent on any failure) and, if your config pinned an older version, prints a one-line stderr nudge. It never blocks startup, sends no data, and touches nothing but stderr. Disable with `EPS_NO_UPDATE_CHECK=1` (corporate/no-egress). The remote server does **not** run this check.

## Tools

One tool per verification endpoint, named `eps_<slug with underscores>` — e.g. `eps_pan_lite`, `eps_bank_account_verification`, `eps_verify_gstin`, `eps_driving_license`. Every tool description carries the billing reminder; input schemas (required params, types, examples — including item shapes for array params like bulk `entries`) are generated from the API specs. Multi-step flows (mobile OTP, DigiLocker, bulk verify) are exposed as their individual steps — the server is stateless; your agent carries intermediate ids between calls, and each step's description says which tool comes next and which field carries over.

Every tool declares MCP annotations: `openWorldHint: true` on all (they call a paid external API), and `readOnlyHint: false` + `idempotentHint: false` on the side-effecting ones — `eps_bank_account_verification` (live, non-refundable ₹1 penny-drop), the two bulk-submit tools (enqueue async batches), `eps_mobile_otp_send`/`eps_mobile_otp_verify` (send/consume an OTP), and `eps_digilocker_create_url` (creates a consent session). Their descriptions state the side effect instead of "Read-only verification". Hosts should gate side-effecting tools accordingly; billing applies to **all** successful calls either way.

Errors come back sanitized as `{ code, message }`: `VALIDATION` (names the missing/invalid params — never their values), `TOOL_NOT_ALLOWED`, `UNKNOWN_TOOL`, `UPSTREAM_TIMEOUT`, `UPSTREAM_ERROR`. Successful upstream envelopes (including business failures like "PAN not found") are returned verbatim — they are your data.

## Data handling

The remote server is a stateless pass-through signer:

- **No persistence.** No database, no cache, no session store. Credentials exist only for the lifetime of the request that carried them.
- **No body logging.** The access log records method, path, status, duration, request id, and the tool _name_ — never headers, tool arguments, or upstream responses (verification traffic carries PAN/Aadhaar/bank data).
- **TLS only.** The container binds loopback behind a reverse proxy; plaintext ingress is never exposed.

## Development

```sh
# from the repo root — bakes data/eps.json for all packages
npm run build

npm run transact:test        # builds the SDK dep, runs vitest
npm run transact:dev         # HTTP server on :8788 with tsx watch
npm run transact:typecheck
```

Four utils (`fetchTimeout`, `requestId`, `accessLog`, `update-check`) are hand-copied/adapted from eps-backend / eps-context-mcp; `parity.copied-utils.test.ts` pins a content hash of both sides of each pair, so editing either file fails the suite until you diff the pair, port what applies, and paste the replacement hash printed in the failure.

Tests never call Eko; upstream fetch is injected. The one exception is the opt-in live UAT smoke (`uat-smoke.test.ts`), which self-skips unless real UAT credentials are set. Copy `.env.example` to `.env` in this package (gitignored; vitest loads `EPS_UAT_*` from it) or pass the vars inline — inline wins:

```sh
EPS_UAT_DEVELOPER_KEY=… EPS_UAT_ACCESS_KEY=… EPS_UAT_INITIATOR_ID=… \
  npm test -w @ekoindia/eps-transact-mcp
```

Run it before any deploy that changes base URLs or signing — it is the only proof the bundle's environment URLs are live-correct.

Deployment (image, compose service, reverse proxy) is documented in [`docs/eps-transact-mcp.md`](../../docs/eps-transact-mcp.md).
