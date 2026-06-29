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

## Deferred

`/credentials` (UAT/live key view/generate) — pending the Eko credential
issuance API contract. See the design spec.
