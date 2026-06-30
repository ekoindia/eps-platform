# @ekoindia/eps-backend

Standalone BFF for the EPS platform. Developer login via mobile+OTP and admin
login via GitHub OAuth, delegating OTP + profile to the Eko backend
("SimpliBank"). Stateless except for ephemeral KV (rate-limit + refresh tokens).

## Run

	cp .env.example .env   # fill in secrets
	npm run build -w @ekoindia/eps-backend
	npm start -w @ekoindia/eps-backend

## Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | /auth/otp/start | none | Send mobile OTP (Eko 515) |
| POST | /auth/otp/verify | none | Verify OTP (518), fetch profile (151), set session |
| GET  | /me | cookie | Profile + lifecycle state |
| POST | /auth/refresh | refresh cookie | Rotate session |
| POST | /auth/logout | cookie | Revoke session |
| GET  | /auth/admin/github | none | Begin admin OAuth |
| GET  | /auth/admin/github/callback | none | Complete admin OAuth |
| GET  | /healthz | none | Liveness |
| GET  | /readyz  | none | Readiness; PINGs Redis when configured, else always 200 |

## Scaling & storage backends

Two KV backends are available, selected at startup based on whether `REDIS_URL`
is set:

| Mode | Backend | When to use |
| --- | --- | --- |
| In-memory | `createInMemoryKV` (default) | Single instance; no external dependency |
| Redis | `createRedisKV` | Multi-instance, restarts, rolling deploys |

**In-memory** is process-local. Refresh tokens, OAuth state, and rate-limit
windows are not shared across processes — running more than one replica will
cause token-validation failures and ineffective rate limits.

**Redis** makes all of that shared and durable across restarts. Swap between
self-hosted and managed/serverless Redis by changing `REDIS_URL` only
(standard RESP-over-URL). Minimum capability floor: **Redis ≥ 6.2** (`GETDEL`)
with Lua scripting enabled.

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

### Rollback

Rolling back from Redis mode to the previous in-memory binary requires
flushing the session keys written to Redis, because the key format and value
encryption differ. Before restarting with the old binary:

	redis-cli --scan --pattern 'rt:*' | xargs redis-cli del
	redis-cli --scan --pattern 'ghtoken:*' | xargs redis-cli del

On a dedicated instance you can use `FLUSHDB` instead. All affected users will
need to re-authenticate.

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

| Variable | Default | Purpose |
| --- | --- | --- |
| `GITHUB_EDIT_BASE` | `dev` | Base branch for edit PRs. |
| `GITHUB_PROD_BASE` | `main` | Target branch for deploy PRs. |

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
`kv.set` is a separate layer and may still surface as 502.)

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

| Key class / call site                                            | Method      | Policy        | Result on KV outage                                       |
| ---------------------------------------------------------------- | ----------- | ------------- | --------------------------------------------------------- |
| `rl:*`, `otp:mob:`, `otp:ip:`, `otp:verify:ip:` (gates)         | incr        | fail-closed   | 503 `RATE_LIMIT_UNAVAILABLE` _(unchanged)_                |
| `otp:fail:` read + incr (brute-force)                            | get/incr    | fail-closed   | 503 `RATE_LIMIT_UNAVAILABLE` _(unchanged, via `kvOr503`)_ |
| refresh-token `rt:*` set (OTP login, admin login, rotation)      | set         | fail-closed   | 503 `STORE_UNAVAILABLE`                                   |
| refresh-token `rt:*` consume (rotation single-use)               | getdel      | fail-closed   | 503 `STORE_UNAVAILABLE`                                   |
| `ghstate:` set / get / del (OAuth state single-use)              | set/get/del | fail-closed   | 503 `STORE_UNAVAILABLE`                                   |
| `ghtoken:` set (admin token persistence)                         | set         | fail-closed   | 503 `STORE_UNAVAILABLE`                                   |
| `ghtoken:` get (mutation gate, refresh read)                     | get         | fail-closed   | 503 `STORE_UNAVAILABLE`                                   |
| `ghtoken:` TTL re-extend on `/auth/refresh`                      | set         | **fail-open** | best-effort, refresh still succeeds                       |
| `otp:fail:` del after success                                    | del         | fail-open     | best-effort _(unchanged)_                                 |
| refresh `rt:*` del + `ghtoken:` del on logout                    | del         | fail-open     | best-effort, logout still 200 _(unchanged)_               |
| GitHub API malformed / unreachable                               | —           | —             | 502 `UPSTREAM_ERROR` / `GitHubApiError` _(unchanged)_     |

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
and ongoing ops — see [`docs/eps-backend-vm-deploy.md`](../../docs/eps-backend-vm-deploy.md).

## Deferred

`/credentials` (UAT/live key view/generate) — pending the Eko credential
issuance API contract. See the design spec.
