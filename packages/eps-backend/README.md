# @ekoindia/eps-backend

Standalone BFF for the EPS platform. Developer login via mobile+OTP and admin
login via GitHub OAuth, delegating OTP + profile to the Eko backend
("SimpliBank"). Stateless except for ephemeral KV (rate-limit + refresh tokens).

## Run

    cp .env.example .env   # fill in secrets
    npm run build -w @ekoindia/eps-backend
    npm start -w @ekoindia/eps-backend

## Endpoints

| Method | Path                        | Auth           | Purpose                                                 |
| ------ | --------------------------- | -------------- | ------------------------------------------------------- |
| POST   | /auth/otp/start             | none           | Send mobile OTP (see Auth providers)                    |
| POST   | /auth/otp/verify            | none           | Verify OTP, classify profile, set session               |
| GET    | /me                         | cookie         | Profile + lifecycle state                               |
| POST   | /auth/refresh               | refresh cookie | Rotate session                                          |
| POST   | /auth/logout                | cookie         | Revoke session                                          |
| GET    | /auth/admin/github          | none           | Begin admin OAuth                                       |
| GET    | /auth/admin/github/callback | none           | Complete admin OAuth                                    |
| GET    | /healthz                    | none           | Liveness                                                |
| GET    | /readyz                     | none           | Readiness; PINGs Redis when configured, else always 200 |
| POST   | /context/mcp                | none (public)  | Anonymous MCP server (docs lookups); only when `CONTEXT_BUNDLE_URL` is set |
| GET    | /context/healthz            | none (public)  | Served bundle version + source                          |
| POST   | /chat/ask                   | cookie         | Grounded docs assistant; 503 `CHAT_DISABLED` unless `EPS_CHAT_*` is set |
| POST   | /activation-fee/intimate    | cookie         | Partner reports paying the one-time activation fee; mails Team Eko. 503 `ACTIVATION_FEE_DISABLED` unless `ACTIVATION_FEE_WEBHOOK_URL` is set |

## Auth providers

Who answers "is this the right OTP for this mobile, and whose account is it" is
chosen at startup by whether `CONNECT_API_BASE_URL` is set. Both providers stay
supported; neither is going away.

| Provider  | Selected when                | Login path                                                  |
| --------- | ---------------------------- | ----------------------------------------------------------- |
| `eko`     | `CONNECT_API_BASE_URL` unset | SimpliBank interactions 515 → 518 → 151, directly (default) |
| `connect` | `CONNECT_API_BASE_URL` set   | Eloka's connect-api `/authentication/sendotp` + `/login`    |

The startup line `[eps-backend] auth provider: <name>` records which one is live.

**This is a configuration fallback, not an availability one.** The choice is
made at boot, so a connect-api outage does _not_ silently fail over to the
direct path — switching providers is a redeploy.

### What the `connect` provider changes, and what it does not

Delegating login gives both products one identity, one OTP journey, and one
upstream session. It changes nothing the browser can see: this service still
issues its own `eps_at` / `eps_rt` HttpOnly cookies, and the frontend contract
is untouched.

connect-api's own access/refresh pair never leaves this process. It is sealed
with the same `SecretBox` used for admin GitHub tokens and stored at `ca:<sid>`,
keyed by the session id in the EPS claim. Nothing is ever decoded out of
connect-api's JWT into an EPS claim — connect-api signs an audience it then
skips at verify time, so its tokens are treated as opaque credentials for
calling connect-api and nothing more.

Profile _reads_ are deliberately outside the provider seam: `/me`,
`/wallet/balance`, `/signup/*` and `/transactions/search` call `eko.getProfile`
under either provider, because both ultimately read the same interaction 151.
Only login is delegated, so a connect-api outage cannot break an established
session's profile view.

### Invariants worth not breaking

- **Rate limiting stays here.** connect-api has none on `/sendotp` or `/login`.
  The per-mobile (5) and per-IP (20) OTP limits in this service are the only
  ones on that path.
- **The EPS business-partner gate stays here.** connect-api authenticates the
  entire Eloka user base — retailers, distributors, agents. `mapConnectLogin`
  rejects anything that is not org `CONNECT_ORG_ID` with `user_type` `23`;
  without it any Eloka retailer would hold a developer session on this portal.
- **New-user detection reads `user_type`, never `role_list`.** connect-api
  overwrites the role to `[-5]` for every mobile login
  (`routes/authentication.js:791`), so the role says nothing about who a user is.
- **Persist before cookies.** `/auth/otp/verify` writes `ca:<sid>` first; a
  store failure answers 503 with no `Set-Cookie` at all, because a live session
  holding dropped upstream credentials cannot be rolled back.
- **`/auth/refresh` fails closed.** If the upstream session cannot be kept
  alive, the freshly rotated refresh token is revoked, both cookies are cleared,
  and the caller gets 401 — better than serving a cookie that fails at the first
  upstream call.
- **The browser recovers, then gives up, in one place.** Every frontend call
  goes through `request()` in `src/lib/auth/client.ts`, which answers a 401 with
  a single `/auth/refresh` and replays the request. That refresh is
  **single-flight**: refresh tokens rotate with a `getdel`, so N parallel 401s
  firing N refreshes would have the first consume the token and sign the user
  out of a session that was just renewed. When the refresh cannot save the call
  — or the replay 401s anyway, which is what an admin whose `ghtoken:` expired
  sees — the client notifies `AuthProvider`, which drops the app to `anon` and
  raises one "Your session has expired. Please sign in again." toast. The
  console and `/admin` already render sign-in for `anon`, so the user lands on
  login in place, with the URL intact. `/auth/otp/*` and `/auth/logout` are
  exempt: a 401 there is a bad OTP or an already-dead session, not an expiry.

## Scaling & storage backends

Two KV backends are available, selected at startup based on whether `REDIS_URL`
is set. The backend choice is a **deployment-time decision** — there is
deliberately no runtime failover between them (a mid-flight fallback would
split rate-limit counters and refresh-token state across two stores):

| Mode      | Backend                      | When to use                               |
| --------- | ---------------------------- | ----------------------------------------- |
| In-memory | `createInMemoryKV` (default) | Single process; no external dependency    |
| RESP      | `createRedisKV`              | Multi-instance, restarts, rolling deploys |

**In-memory** is process-local. Refresh tokens, OAuth state, and rate-limit
windows are not shared across processes — the constraint is **exactly one
backend process**, not one VM: PM2 replicas or Node `cluster` workers on the
same machine break it the same way a second VM would. Restarting the process
drops all sessions (every user re-logs-in) and resets rate-limit counters.
This is a supported degraded mode, not just a dev convenience: on a single
small VM with a low user base it removes the KV service entirely. After a
restart, a still-valid access JWT whose `sid` no longer resolves gets 401
`CONNECT_SESSION_EXPIRED` on connect/dashboard routes; the frontend's
refresh-then-logout retry path recovers it to a clean re-login.

**RESP** (any Redis-protocol server) makes all of that shared and durable
across restarts. Swap between self-hosted and managed/serverless by changing
`REDIS_URL` only (standard RESP-over-URL). Minimum capability floor:
**Redis ≥ 6.2 semantics** (`GETDEL`) with Lua scripting enabled. Known-good
servers, in recommended order:

- **Valkey** (FOSS Redis fork, BSD) — what the compose stacks and CI run;
  `valkey/valkey:8-alpine`. Valkey 8 loads Redis 7 AOF/RDB data in place, but
  the upgrade is one-way: snapshot the data volume before switching if a
  rollback to `redis:7` must stay possible.
- **Upstash** free tier (managed, TLS `rediss://`) — the Vercel serverless
  path (see deploy doc); also usable from a VM when running a KV container is
  undesirable. Current traffic (≈200 DAU) sits far below the free 500k
  commands/month.
- **Redis** 6.2+ — works unchanged; note 7.4+ license terms.

**At-rest protection (Redis mode):** the GitHub token value and refresh-token
claim value are encrypted with AES-256-GCM before writing to Redis; refresh
keys are hashed. This requires `KV_ENCRYPTION_KEY` (see env section below).

**Failure behaviour:** the backend is fail-closed on Redis outage for all
KV-dependent auth operations (OTP verify, token refresh, admin callback). A
`POST /auth/logout` always clears the browser cookies regardless of Redis
availability.

### Deploy

A `docker-compose.yml` is provided for running the backend with a local Redis
instance. Use it as a reference for self-hosted deployments:

    docker compose up --build

Deploy targets: pull-based private VM (see [docs/eps-backend-vm-deploy.md](docs/eps-backend-vm-deploy.md))
or managed Vercel serverless (see [docs/eps-backend-vercel-deploy.md](docs/eps-backend-vercel-deploy.md)).

### Rollback

Rolling back from Redis mode to the previous in-memory binary requires
flushing the session keys written to Redis, because the key format and value
encryption differ. Before restarting with the old binary:

    redis-cli --scan --pattern 'rt:*' | xargs redis-cli del
    redis-cli --scan --pattern 'ghtoken:*' | xargs redis-cli del

On a dedicated instance you can use `FLUSHDB` instead. All affected users will
need to re-authenticate.

## Hosted context MCP server (`/context/*`)

Setting `CONTEXT_BUNDLE_URL` mounts the `@ekoindia/eps-context-mcp` server on this
process, published as `https://mcp.eko.in/context/mcp`. It is **anonymous by
design** — every tool is a read-only lookup over the public agent bundle, with no
credentials, no PII and no billable upstream call. Unset the variable and the
routes cease to exist; that is the kill switch.

| Env                     | Default | Meaning                                                      |
| ----------------------- | ------- | ------------------------------------------------------------ |
| `CONTEXT_BUNDLE_URL`    | unset   | Live bundle, e.g. `https://eps.eko.in/agent/eps.json`         |
| `CONTEXT_BUNDLE_TTL_SEC`| `900`   | Re-validation window (conditional GET with `If-None-Match`)   |

What the mount deliberately does **not** share with the rest of the BFF:

- **No cookies, ever.** `/context/*` gets wildcard CORS *without* credentials, so
  a browser will not attach a session cookie to a public endpoint.
- **No session, KV or secretbox access**, and no contribution to `/readyz` — a
  site outage must never fail the deploy health gate for auth.
- **JSON-RPC errors only.** `app.onError` returns an MCP-shaped error body for
  this prefix instead of the BFF's `{error:{code:"UPSTREAM_ERROR"}}` envelope.

The bundle is fetched once at boot (never awaited) and then re-validated lazily
behind the response once `CONTEXT_BUNDLE_TTL_SEC` has lapsed, so a docs change on
the site reaches agents without redeploying anything. A failed or malformed fetch
keeps the last good bundle; before the first success the routes answer `503`.

Abuse protection is the proxy's job — see the `limit_req` block in
[`docs/eps-backend-vm-deploy.md`](docs/eps-backend-vm-deploy.md).

The loaded bundle is owned by `src/context/bundleManager.ts`, not by the mount.
`POST /chat/ask` grounds its answers on the **same object**: two loaders would
mean two fetch schedules and two chances to answer from different bundle
versions inside one deploy.

## AI docs-chat (`POST /chat/ask`)

A signed-in developer asks an EPS integration question; the model answers by
calling the same lookups the MCP server exposes, dispatched **in-process**
against the shared bundle (`src/chat/tools.ts`). Nothing is answered from model
memory — the system prompt says so and the tool descriptions reinforce it,
because the thing this exists to get right (`secret-key = base64(HMAC-SHA256(
timestamp, base64(access_key)))`) is exactly what a general-purpose assistant
gets wrong.

| Env                              | Default            | Meaning                                                        |
| -------------------------------- | ------------------ | -------------------------------------------------------------- |
| `EPS_CHAT_PROVIDER`              | unset              | `anthropic` \| `openai` \| `openrouter`. Unset ⇒ feature dark |
| `EPS_CHAT_API_KEY`               | unset              | Provider key. Must be set together with the provider           |
| `EPS_CHAT_MODEL`                 | `claude-haiku-4-5` | Model id                                                        |
| `EPS_CHAT_BASE_URL`              | provider default   | Override for a gateway / self-host / OpenRouter                 |
| `EPS_CHAT_MONTHLY_BUDGET_USD`    | `0` (off)          | Best-effort monthly cost guard                                  |
| `EPS_CHAT_PRICE_INPUT_PER_MTOK`  | `0`                | USD per 1M input tokens. Required when the budget is set        |
| `EPS_CHAT_PRICE_OUTPUT_PER_MTOK` | `0`                | USD per 1M output tokens. Required when the budget is set       |

Prices are configured, never inferred: `EPS_CHAT_MODEL` and `EPS_CHAT_BASE_URL`
can name anything, and a guessed price would silently mis-meter every request.
Setting a budget without both prices is a **boot error** — an unenforced spend
cap is worse than an obviously absent one.

**Bounds, and why each one exists**

| Bound                                    | Value      | Reason                                                             |
| ---------------------------------------- | ---------- | ------------------------------------------------------------------ |
| Requests per login (`enforceRateLimit`)  | 30 / 600 s | The hard abuse gate. Each request may carry up to 20 messages       |
| Messages per request                     | 20         | Bounds one request's cost                                           |
| Characters per message                   | 4 000      | ditto                                                               |
| Request body                             | 32 KB      | Checked on `content-length` **and** actual bytes, before parsing    |
| Tool rounds                              | 6          | Then one forced tool-free turn, so the reply is always prose        |
| Whole-request deadline                   | 60 s       | One budget shared by every provider call, not 30 s × rounds         |
| Tool result                              | 12 000 ch  | A verbose endpoint must not crowd out the conversation              |

Errors: `401` no session · `403 NOT_DEVELOPER_SESSION` (a `signup`-role session
is mid-onboarding; developers and admins may ask) · `400 BAD_REQUEST` ·
`429 RATE_LIMITED` · `502 UPSTREAM_ERROR` · `503` for `CHAT_DISABLED`,
`CHAT_BUNDLE_UNAVAILABLE`, `CHAT_BUDGET_EXHAUSTED`, `RATE_LIMIT_UNAVAILABLE`.

**Privacy.** No conversation is stored, here or anywhere. Message content never
reaches any log: the access log records `path` only, and a refused request emits
a `chat_denied` security record carrying `rid`, the AppError code and an actor
that is **null** when the denial happened before a session was resolved. A test
asserts the user's words never appear on any denial path.

**Privilege.** `src/http/chat.ts` imports nothing from `clients/github.ts` or
`admin/*` — it is the one route a plain developer can reach that spends money
with a third party, so it holds no privilege it does not need. A test greps the
import list to keep it that way.

**Spend guard is best-effort, by decision.** The counter (`chatspend:<YYYY-MM>`,
weighted micro-USD, ~40-day TTL) checks before and records after, and both halves
fail **open** — a KV outage pauses accounting rather than taking the feature
down. Concurrency can therefore overshoot by up to `concurrency × per-request
cost`. The per-login rate limit is what actually bounds abuse; a true ceiling
would need conditional increments plus reserve/refund around every provider
call, which is not worth it for a login-gated, already rate-limited feature.

## Reverse proxy requirement

Per-IP rate limiting relies on the `x-real-ip` header. A trusted reverse proxy
(e.g. nginx, Caddy) **must** set or overwrite this header before requests reach
the server. Clients can otherwise spoof it to evade IP-scoped limits.

## Local dev (GitHub OAuth)

Admin login uses GitHub OAuth. Three things must agree, or you get `BAD_STATE`:
the GitHub OAuth App's registered callback URL, the backend `GITHUB_CALLBACK_URL`
env (sent verbatim as `redirect_uri` — GitHub requires an exact match), and the
browser origin (the `eps_oauth_state` cookie is set on `/auth/admin/github` and
re-read on the callback, so both must hit the **same origin**).

In dev the frontend runs on `:8080` and proxies `/api/*` to this backend on
`:8787`. Keep the whole flow on the `:8080/api/...` origin — do **not** point the
callback straight at `:8787`, or the state cookie set on `:8080` won't be sent to
`:8787` and the callback fails with `BAD_STATE`.

### 1. Create a dev GitHub OAuth App

Use a **dedicated dev app** (separate credentials from production):

1. https://github.com/settings/developers → **OAuth Apps** → **New OAuth App**
   (for an org-owned app: Org → Settings → Developer settings → OAuth Apps).
2. **Homepage URL:** `http://localhost:8080`
3. **Authorization callback URL:**
   `http://localhost:8080/api/auth/admin/github/callback`
4. Register → copy the **Client ID** → **Generate a new client secret** → copy it
   (shown once).

### 2. Backend env (`.env`)

    GITHUB_CLIENT_ID=<dev app client id>
    GITHUB_CLIENT_SECRET=<dev app client secret>
    GITHUB_CALLBACK_URL=http://localhost:8080/api/auth/admin/github/callback
    GITHUB_REPO=ekoindia/eps-platform   # admin must have write access to this repo
    COOKIE_SECURE=false                 # dev is http; Secure cookies won't set
    ADMIN_POST_LOGIN_REDIRECT=/admin    # optional: where admin lands after GitHub login

    # Redis KV backend (optional; omit both for in-memory single-instance mode)
    REDIS_URL=redis://redis:6379           # optional; omit for in-memory (single instance)
    KV_ENCRYPTION_KEY=<base64 32 bytes>    # REQUIRED when REDIS_URL is set
                                           # generate: openssl rand -base64 32
    REDIS_TLS_REJECT_UNAUTHORIZED=true     # set false only for a self-signed managed cert

### 3. Run both

    npm run backend:dev   # backend on :8787 (watch mode)
    npm run dev           # frontend on :8080 (proxies /api -> :8787)

Visit `http://localhost:8080/admin` → "Sign in with GitHub". Admin access is
gated on **write** permission to `GITHUB_REPO`.

## Admin GitOps console

Admins can edit documentation and endpoint notes directly from the `/admin` page,
with changes automatically committed as pull requests. See [`docs/admin-console.md`](../../docs/admin-console.md)
for the complete feature guide.

Two additional environment variables control the GitOps flow:

| Variable           | Default | Purpose                       |
| ------------------ | ------- | ----------------------------- |
| `GITHUB_EDIT_BASE` | `dev`   | Base branch for edit PRs.     |
| `GITHUB_PROD_BASE` | `main`  | Target branch for deploy PRs. |

### Security: authorization freshness & rate limiting

**Live repo-write re-check.** Admin write endpoints (`POST /admin/docs/propose`,
`POST /admin/deploy/production`) re-verify the acting admin's GitHub repo-write
access **on every call**, immediately before the mutation — not just at login.
A revoked collaborator is blocked on their next attempt. Outcomes:

- write access confirmed → proceeds.
- write access revoked → `403 WRITE_ACCESS_REVOKED` ("sign in again").
- GitHub unreachable / rate-limited / 5xx → `503 UPSTREAM_UNAVAILABLE` (the
  check fails closed; a GitHub secondary-rate-limit is reported as transient,
  never as a revocation).

Admin login itself grants a session **only** on confirmed write access; a
GitHub user without repo write receives `403 NOT_AUTHORIZED` and no session.

**Rate limits** (fixed 10-minute window):

| Endpoint                              | Scope                            | Limit / 10 min |
| ------------------------------------- | -------------------------------- | -------------- |
| `GET /auth/admin/github` (login init) | per client IP                    | 15             |
| `GET /auth/admin/github/callback`     | per client IP (valid-state only) | 15             |
| `POST /admin/docs/propose`            | per admin login                  | 30             |
| `POST /admin/deploy/production`       | per admin login                  | 10             |
| `POST /auth/otp/start`                | per mobile / per IP              | 5 / 20         |

Exceeding a limit returns `429 RATE_LIMITED`. If the rate-limit store (Redis)
is unreachable the request fails closed with `503 RATE_LIMIT_UNAVAILABLE`.
Per-IP limits trust the `x-real-ip` header, which the reverse proxy must
set/overwrite. The callback limiter runs after single-use OAuth-state
consumption, so a forged or replayed state cannot exhaust a shared IP's budget.

### Security: event log

Security-relevant admin events are emitted as single-line JSON to **stdout**,
tagged `"type":"security_audit"` for downstream log filtering. The log is
**best-effort** — a logging failure never affects a request — and is the
system of record only for the _negative space_ GitHub cannot see. Successful
`propose`/`deploy` mutations are **not** logged (their commit/PR in GitHub is
the durable record).

Captured events:

| event            | outcome | when                                                                      |
| ---------------- | ------- | ------------------------------------------------------------------------- |
| `admin_login`    | granted | admin OAuth sign-in succeeds (records `actor`, `ip`, `sid`)               |
| `admin_login`    | denied  | non-write GitHub user (`reason` = `no-write`/`unknown`) or `OAUTH_FAILED` |
| `admin_mutation` | denied  | `propose`/`deploy` rejected at a gate (`reason` = the `AppError` code)    |

Record shape:

```json
{
	"type": "security_audit",
	"ts": "<ISO8601>",
	"event": "admin_login|admin_mutation",
	"outcome": "granted|denied",
	"action": "propose|deploy|null",
	"actor": "@login|unknown",
	"reason": "<code>|null",
	"ip": "<x-real-ip>|unknown",
	"sid": "<id>|null"
}
```

`actor` is the GitHub `@login` once the session is resolved, else `"unknown"`
(e.g. `BAD_ORIGIN`, `NOT_AUTHORIZED`, `NO_GH_TOKEN`). `ip` comes from the
`x-real-ip` header set by the trusted reverse proxy. Forged/replayed OAuth
`BAD_STATE` callbacks are deliberately not logged (unauthenticated, unbounded —
logging them would be a log-flood vector).

**otp/verify outage contract:** the brute-force-gate KV calls in
`/auth/otp/verify` (counter reads and the invalid-OTP increments) now return
**503 `RATE_LIMIT_UNAVAILABLE`** on a KV outage instead of a raw 502; the
post-success counter cleanup is best-effort. (The post-verify session-issuance
`kv.set` now returns **503 `STORE_UNAVAILABLE`** on a KV outage, fail-closed via the store seam.)

### Security: KV fail-open/closed matrix

**Default rule:** an unguarded KV call **fails closed** — `withStoreErrors`
wraps the store seam so any outage throws `StoreUnavailableError`, which
`app.onError` maps to **503 `STORE_UNAVAILABLE`**. Fail-open is the deliberate
exception, marked at the call site with `.catch(() => {})`. This makes the safe
behavior the default and forces fail-open to be an explicit, reviewable choice.

**`STORE_UNAVAILABLE` 503 contract:** the store is transiently unreachable. The
client should retry; the outage is not a permanent error and carries no semantic
about the request payload.

Per-key-class outage policy:

| Key class / call site                                       | Method      | Policy        | Result on KV outage                                       |
| ----------------------------------------------------------- | ----------- | ------------- | --------------------------------------------------------- |
| `rl:*`, `otp:mob:`, `otp:ip:`, `otp:verify:ip:` (gates)     | incr        | fail-closed   | 503 `RATE_LIMIT_UNAVAILABLE` _(unchanged)_                |
| `otp:fail:` read + incr (brute-force)                       | get/incr    | fail-closed   | 503 `RATE_LIMIT_UNAVAILABLE` _(unchanged, via `kvOr503`)_ |
| refresh-token `rt:*` set (OTP login, admin login, rotation) | set         | fail-closed   | 503 `STORE_UNAVAILABLE`                                   |
| refresh-token `rt:*` consume (rotation single-use)          | getdel      | fail-closed   | 503 `STORE_UNAVAILABLE`                                   |
| `ghstate:` set / get / del (OAuth state single-use)         | set/get/del | fail-closed   | 503 `STORE_UNAVAILABLE`                                   |
| `ghtoken:` set (admin token persistence)                    | set         | fail-closed   | 503 `STORE_UNAVAILABLE`                                   |
| `ghtoken:` get (mutation gate, refresh read)                | get         | fail-closed   | 503 `STORE_UNAVAILABLE`                                   |
| `ghtoken:` TTL re-extend on `/auth/refresh`                 | set         | **fail-open** | best-effort, refresh still succeeds                       |
| `ca:` set (connect-api session persist, before cookies)     | set         | fail-closed   | 503 `STORE_UNAVAILABLE`, and **no `Set-Cookie` at all**   |
| `ca:` get on `/auth/refresh` (upstream keep-alive)          | get         | fail-closed   | 401 `SESSION_EXPIRED` + cookies cleared                   |
| `otp:fail:` del after success                               | del         | fail-open     | best-effort _(unchanged)_                                 |
| refresh `rt:*` del + `ghtoken:` / `ca:` del on logout       | del         | fail-open     | best-effort, logout still 200 _(unchanged)_               |
| `dash:` / `dash:svc:` cache get + set (`/dashboard`)        | get/set     | **fail-open** | cache miss → upstream call still runs, response 200       |
| GitHub API malformed / unreachable                          | —           | —             | 502 `UPSTREAM_ERROR` / `GitHubApiError` _(unchanged)_     |

**Boundaries — what is not `STORE_UNAVAILABLE`:**

- **Rate-limit / brute-force gates** (`enforceRateLimit`, `kvOr503`) catch
  `StoreUnavailableError` first and re-throw as `AppError(503, RATE_LIMIT_UNAVAILABLE)`,
  so those paths keep their more specific code.
- **GitHub / upstream errors** are remapped to `AppError(502, UPSTREAM_ERROR)`
  inside the GitHub client layer before `app.onError` sees them; they cannot be
  misrouted to 503.
- **`/readyz`** is unchanged — the readiness probe calls Redis `ping()` internally
  and returns `{ ready: false }` on failure. `STORE_UNAVAILABLE` applies only to
  per-request KV operations.
- **Encrypt/decrypt failures stay 502.** `secretbox.encrypt(...)` runs before
  `kv.set(...)` on token-persistence paths; an encryption failure is not a store
  outage, throws a different error type, and remains the generic 502 path.

**Refresh-rotation half-failure:** `rotateRefresh` (`src/auth/session.ts`) is a
two-step destructive operation: `getdel(old)` consumes the old refresh token, then
`set(new)` persists the rotated one. If `getdel` succeeds but the subsequent `set`
throws, the old token is already gone and the new one is not stored — the user must
re-authenticate. This surfaces as **503 `STORE_UNAVAILABLE`** and is the accepted
fail-closed outcome: rotation is intentionally non-atomic to preserve the
single-use guarantee (making it atomic would briefly allow two valid tokens to
coexist, widening the replay window).

### Security: correlation id & access log

Every HTTP request is assigned a **correlation id** (`rid`) before any
application logic runs:

- If the reverse proxy sets an inbound `x-request-id` header the value is
  sanitized (only `[A-Za-z0-9._-]`, capped at 128 characters) and reused as
  `rid`. An upstream value that reduces to empty is treated as absent.
- Otherwise a fresh `randomUUID()` is minted.
- `rid` is returned to the caller in the **`x-request-id` response header**,
  which is listed in the CORS `exposeHeaders` list so browser JS can read it.

A structured **access log** line is emitted to **stdout** for every request
_except_ `/healthz` and `/readyz` (probe noise is excluded). Each line is a
single JSON object tagged `"type":"access"` for downstream filtering:

```json
{
	"type": "access",
	"ts": "<ISO8601>",
	"rid": "<correlation-id>",
	"method": "POST",
	"path": "/auth/otp/start",
	"status": 200,
	"durMs": 42,
	"ip": "<x-real-ip>|unknown"
}
```

`rid` is threaded into the unhandled-error log and into every `security_audit`
record, so a single id ties together a request's access line, any security
event it raised, and any unhandled error it produced.

**Log consumers** should filter on the `type` field: `"access"` for traffic
visibility and `"security_audit"` for admin/auth events (see _Security: event
log_ above). Both types land on the same stdout stream.

**Trust note:** `rid` is informational only — it keys no authorization or
rate-limit decision. Reusing the inbound header is therefore safe: a forged
value affects only the caller's own correlation data.

### Observability: upstream (Eko/SimpliBank + connect-api) log

Every request/response to an upstream is logged to **stdout** as a single JSON
object, one line per call. `EKO_LOG_LEVEL` governs **both** upstream clients;
the `type` tag says which transport produced the line:

| `type`             | client                     | identified by                             |
| ------------------ | -------------------------- | ----------------------------------------- |
| `eko_upstream`     | Eko/SimpliBank (`eko.ts`)  | `interaction_type_id` (e.g. `515`, `518`) |
| `connect_upstream` | connect-api (`connect.ts`) | `path` (e.g. `/authentication/sendotp`)   |

Grep one transport with `docker logs … | grep connect_upstream`. Verbosity is set
by `EKO_LOG_LEVEL` so it can differ between dev and prod:

| level               | what it logs                                                                                                                                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `off`               | nothing                                                                                                                                                                                                                                                 |
| `basic` _(default)_ | `interaction_type_id`, **masked** mobile, `org_id`, `http_status`, `durMs`, and a response summary (`response_status_id` / `response_type_id` / `response_code` / `status` / `message`, plus the field-level diagnostics `invalid_params` / `dependent_params` / `list_items`). No OTP, no merchant credentials, no `data`, no full body — **prod-safe.** |
| `full`              | the complete request form-fields (**including the OTP**) and the full response body. **Dev debugging only.**                                                                                                                                            |

The `developer_key` / `secret-key` auth headers are never part of the logged
form-fields, so they are never emitted at any level. Logging is best-effort and
never throws or alters an upstream call.

**Redaction** happens inside the logger, so no call site can forget it, and it
**recurses** — a credential nested inside a JSON body is caught wherever it
sits. Redacted at `full` on top of the above: request `first_okekey` /
`second_okekey` / `id_token` (the connect-api OTP) / `refresh_token` /
`access_token`, and response `pintwin_key` / `access_token` /
`access_token_lite` / `refresh_token`. The multipart upload transport logs only
its **part names** (`{"multipart_parts":"formdata,file1"}`) — never the KYC
scans and selfies it carries.

**Every exit path logs exactly once** — success, non-2xx, unparseable body,
body-read failure, and transport failure alike. This is load-bearing: connect-api
answers HTTP 200 with a non-zero `response_status_id` for business-level
failures, which the BFF deliberately collapses into a uniform `502
OTP_SEND_FAILED` (no per-mobile detail, no enumeration). The upstream `message`
in this log is therefore the **only** place the real reason appears.

`message` alone is often a template — a missing field answers `"Please provide
the value of the field"` and names it only under `invalid_params`. That is why
`basic` keeps `invalid_params` / `dependent_params` / `list_items`: they carry
field **names** and framework message templates, never user values. Signup step
failures forward the same object to the browser as `error.details` on the 400,
so a field-level rejection is diagnosable from either end. Everything else —
`data` above all — stays behind `full`.

**Reading the logs in dev.** The raw JSON lines are hard to scan. Run
`npm run dev:pretty` instead of `npm run dev` — it pipes stdout through
`jq -R -r -C --tab 'fromjson? // .'`, which tab-indents and colorizes each JSON
record in full (non-JSON lines pass through untouched). Set `EKO_LOG_LEVEL=full`
in `.env` to include the complete request/response bodies. Requires `jq`.
Example (`basic`) raw line:

```json
{
	"type": "eko_upstream",
	"ts": "<ISO8601>",
	"rid": "<correlation id>",
	"interaction_type_id": "518",
	"http_status": 200,
	"durMs": 37,
	"error": null,
	"mobile": "••••••0001",
	"org_id": "1",
	"response": { "response_status_id": 0, "message": "OK" }
}
```

### Observability: request trace on error responses

The upstream log answers "what happened" for whoever can read stdout. The
**request trace** answers it for whoever is holding the failure — a partner on a
support call, or the developer reading a screenshot.

`src/http/trace.ts` opens an `AsyncLocalStorage` scope per request (mounted in
`createApp` immediately after `requestId()`, whose `rid` it adopts). Every
upstream call recorded by `createEkoLogger` lands in that scope, and `onError`
puts what it collected on the error envelope as a **sibling of `error`**:

```json
{
	"error": { "code": "STEP_FAILED", "message": "…", "source": "api" },
	"rid": "3f2a1b7c-…",
	"ts": "2026-08-25T09:12:44.180Z",
	"version": "74c5eb3",
	"trace": [
		{
			"path": "/interactions",
			"clientRefId": "m8x2k1p0aa",
			"status": 200,
			"durMs": 214,
			"error": null,
			"response": { "response_status_id": 1, "message": "…" }
		}
	]
}
```

`clientRefId` is the point of the whole thing: it is the one field Eko's support
team can look a transaction up by, and it is otherwise invisible outside our
container logs.

**Who sees what.** Metadata — `path`, `clientRefId`, `status`, `durMs`, `error` —
goes to every caller. The `response` body is added only once a session has
verified, which `verifyAccess` reports by calling `markAuthenticated()`. That is
the single point every route resolves a session through, so a route added later
is covered without opting in. Bodies are redacted (`REDACTED_RESPONSE_FIELDS`
strips tokens and `pintwin_key`) but redaction removes credentials, not personal
data — hence the gate.

**Caps**, because a trace rides in an error response: at most 10 calls per
request, 8 KB per body, depth 6, 20 array items, 1,000 chars per string, with
cycles cut. Anything dropped sets `truncated: true` rather than passing a partial
body off as complete. The whole path is best-effort: a trace failure must never
be what breaks the error response, and `trace` is omitted entirely when nothing
was recorded.

Independent of `EKO_LOG_LEVEL` by design — a browser-side diagnostic must not
depend on how the operator set a server log's verbosity.

### The rest of the error envelope

Alongside `trace`, every error body carries `rid` (the same value as the
`x-request-id` header — in the body too, because a screenshot shows the body and
never the headers), `ts` (server clock, so a skewed browser clock cannot
mislead), and `version` (the build that served it).

`error.source` says **who produced the message**, which is the first thing ops
needs from a screenshot:

| `source` | Meaning | Where it goes |
| --- | --- | --- |
| `api` | The upstream call failed and `message` is its envelope message | Forward to Eko |
| `proxy` | This service produced it — a guard, a validation, a failure it could not get an upstream answer for | Backend team |
| `client` | Added by the frontend for failures that never reached the network (`NETWORK_ERROR`) | Frontend / the user's connection |

The frontend also files `PARSE_ERROR` — a response that is not JSON — as
`proxy`: an nginx or Vercel error page, or an SPA fallback, is an intermediary
answering, never the browser. See `docs/error-handling.md`.

Use `AppError.fromUpstream(...)` wherever the message is `envelope.message`; the
plain constructor defaults to `proxy`, so an error is ours unless it says
otherwise. `AppError.fromUpstream` is deliberately greppable — it finds every
forwarded message in one search.

The unhandled branch adds one more field. It still answers `502 UPSTREAM_ERROR
"Something went wrong"`, but `cause` now carries what actually threw (`"Eko
upstream HTTP 503"`), scrubbed of URL credentials and capped at 200 characters.
It is withheld from anonymous callers, since it names our own hosts and paths.

`errorBody` has exactly five call sites — the four `onError` branches and
`app.notFound` — and all five carry the diagnostics. No route builds an error
envelope itself; if one ever does, it will silently skip all of this.

### Success responses: `x-eps-debug`

Errors carry their trace unconditionally. Successes do not — adding upstream
bodies to every dashboard and transaction payload would multiply response sizes
for a diagnostic nobody is reading.

Send `x-eps-debug: 1` to get it anyway, as `_diag` on the response body. Gated
three ways: the caller must ask, must have a verified session, and the response
must be a 2xx `application/json` object. Streaming, binary and non-JSON
responses pass through untouched — buffering and re-serializing them would
corrupt them. The console sets the header automatically in dev, and in
production only when `sessionStorage["eps.debug"] === "1"`.

### `x-eps-version`

Every response — success or failure — carries the running build on
`x-eps-version`, CORS-exposed so browser JS can read it. It comes from the
`EPS_VERSION` env var, falling back to `dev`; stamp it at image build time:

    docker build --build-arg EPS_VERSION=$(git rev-parse --short HEAD) …

"Is production actually running this code?" is the question that precedes every
other one during an incident, and the deploy poller can latch a stale image
without anything else showing it.

## Production deploy (pull-based, private VM)

The production stack runs on a single private VM under `docker-compose.prod.yml`.
A lightweight poller container watches the `ghcr.io/ekoindia/eps-backend:prod`
tag in GHCR and reconciles the running image on each 30-second tick. No SSH or
agent access from CI is required.

**Architecture:**

    CI push to main → CI green → deploy-eps-backend workflow →
      build :sha, retag :prod (atomic) →
      poller detects digest change → pulls + recreates eps-backend →
      health gate (/readyz) → marks last_good or rolls back

The deploy gate is the **`main` branch merge** — CI must pass before the
workflow runs. Branch protection (required reviews + required CI) on `main`
is therefore a hard operational prerequisite.

**Backend port:** `127.0.0.1:8787`. The backend binds only to the loopback
interface. Point your reverse proxy (nginx, Caddy, etc.) at that address.

**Invariant compose command** — all operator actions use this exact form:

    docker compose -p eps-backend --project-directory /deploy \
      --env-file /deploy/deploy.env -f /deploy/docker-compose.prod.yml <cmd>

`deploy.env` holds a single line (`EPS_BACKEND_IMAGE=...`) that the poller
rewrites atomically on each deploy; the operator seeds it once at bootstrap.
The poller reads operator secrets (including `POLLER_ALERT_WEBHOOK`) from
`/deploy/.env` via `env_file`.

The poller authenticates to the private GHCR package for skopeo digest checks
by mounting the host's `~/.docker/config.json` read-only into the container;
run `docker login ghcr.io` on the VM before starting the stack.

For the full operator runbook — bootstrap, rollback, HOLD handling, alerts,
and ongoing ops — see [`docs/eps-backend-vm-deploy.md`](docs/eps-backend-vm-deploy.md).
For day-2 one-liners — status, logs, restarts, `.env` changes, Redis, triage —
see [`docs/eps-backend-docker-ops.md`](docs/eps-backend-docker-ops.md).

## Deferred

`/credentials` (UAT/live key view/generate) — pending the Eko credential
issuance API contract. See the design spec.

## Activation-fee intimation

`POST /activation-fee/intimate` backs `/console/pay-activation-fee`. Production
credentials unlock every API on the platform, so the one-time activation fee is
collected on trust: the partner transfers the money to Eko's bank account, tells
us here, and finance reconciles it against the statement. **Nothing on this
route confirms a payment** — it only carries the claim.

Multipart body: a `payload` JSON part (`amount`, `date`, `mode`, `utr`,
`products[]`, `otherProducts`) plus an optional `attachment` (JPG/PNG/PDF, 5 MB).

The identity half of the mail — name, EkoCode, mobile, email, PAN, GST — is read
from the caller's own upstream profile via `eko.getProfile` and **never** from
the request body, so a partner cannot file an intimation in someone else's name.
PAN comes from `user_detail.pancardnumber`; GST has no agreed upstream field
name, so it is a best-effort scan of the allowlisted business detail blocks for
a key matching `/gst/i`, and prints as `—` when the profile carries none.

| Env var                      | Default                                        | Notes                                                            |
| ---------------------------- | ---------------------------------------------- | ---------------------------------------------------------------- |
| `ACTIVATION_FEE_WEBHOOK_URL` | _(unset — feature dark)_                       | https required off loopback. **Secret**; never ship to the browser |
| `ACTIVATION_FEE_RECIPIENTS`  | `eps@eko.in,finance@eko.co.in,amar@eko.co.in`  | Comma-separated. Empty or malformed = boot error                 |
| `ACTIVATION_FEE_TIMEOUT_MS`  | `20000`                                        | Abort for the webhook call                                       |

> An n8n `/webhook-test/...` URL only fires while the workflow editor is open
> and listening. Production must use the `/webhook/...` URL, or every
> intimation is silently dropped.
