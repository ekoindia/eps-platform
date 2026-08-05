# eps-backend — Docker Ops Cheatsheet

Day-2 operation of the production stack on the VM: status, logs, restarts,
env changes, Redis, capacity, triage.

This is the **quick-reference companion** to the
[VM deploy runbook](./eps-backend-vm-deploy.md). Anything one-time (bootstrap,
nginx/TLS, GHCR auth) or procedural (manual rollback, clearing HOLD) lives
there and is linked from here, not repeated.

---

## Contents

1. [The invariant command](#1-the-invariant-command)
2. [Where everything lives](#2-where-everything-lives)
3. [Status & health](#3-status--health)
4. [Logs](#4-logs)
5. [Restart & recreate](#5-restart--recreate)
6. [Changing `.env` safely](#6-changing-env-safely)
7. [Redis / Valkey](#7-redis--valkey)
8. [Capacity](#8-capacity)
9. [Triage](#9-triage)
10. [Local dev](#10-local-dev)

---

## 1. The invariant command

Every production command uses the same Compose form. Define it once per shell
session and use `dc` for the rest of this doc:

```sh
dc() {
  docker compose -p eps-backend \
    --project-directory /data/eps-backend \
    --env-file /data/eps-backend/deploy.env \
    -f /data/eps-backend/docker-compose.prod.yml "$@"
}
```

Each flag earns its place — dropping one does not always fail loudly:

| Flag                                    | Drop it and…                                                                                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `-p eps-backend`                        | project name falls back to the CWD's basename → **a second, empty stack** with different container and volume names                                          |
| `--env-file …/deploy.env`               | `${EPS_BACKEND_IMAGE}` resolves to empty → Compose errors loudly on `up`, but `config` will happily print an image-less service                              |
| `--project-directory /data/eps-backend` | `env_file: .env` and the `./` bind mounts resolve relative to the compose file's directory instead → silently wrong secrets/mounts if you run from elsewhere |
| `-f …/docker-compose.prod.yml`          | Compose picks up whatever `docker-compose.yml` is in the CWD                                                                                                 |

Run the `dc` commands from anywhere; they carry absolute paths. Anything in
this doc using a bare `.env` path means `/data/eps-backend/.env`.

---

## 2. Where everything lives

| Path / name                                       | What                                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------------------- |
| `/data/eps-backend/docker-compose.prod.yml`       | stack definition (3 services)                                                   |
| `/data/eps-backend/.env` (`chmod 600`)            | operator secrets — `env_file` for **both** `eps-backend` and `poller`           |
| `/data/eps-backend/deploy.env`                    | only `EPS_BACKEND_IMAGE=…`, rewritten atomically by the poller each deploy      |
| `/data/eps-backend/.ghcr-auth.json` (`chmod 600`) | GHCR creds, mounted read-only into the poller                                   |
| services                                          | `redis`, `eps-backend`, `poller`                                                |
| volumes                                           | `eps-backend_eps-redis-data`, `eps-backend_eps-poller-state`                    |
| networks                                          | `eps-internal` (`internal: true`, no egress), `eps-egress`                      |
| images                                            | `ghcr.io/ekoindia/eps-backend:{<sha>,prod}`, `ghcr.io/ekoindia/eps-poller:prod` |
| listen address                                    | `127.0.0.1:8787` (loopback only; nginx fronts it at `api.eps.eko.in`)           |
| Docker data-root                                  | `/data/docker`, storage driver **vfs** — no layer sharing, images are fat       |

Address containers by **service name** (`dc ps -q eps-backend`), not by the
generated `eps-backend-eps-backend-1` name — the suffix changes if a service is
ever scaled or renamed.

---

## 3. Status & health

```sh
dc ps                          # what's up, health status, uptime
docker stats --no-stream       # CPU/mem across every stack on the VM
```

Two different endpoints, two different consumers — don't confuse them:

| Endpoint   | Means                                                                | Used by                  |
| ---------- | -------------------------------------------------------------------- | ------------------------ |
| `/healthz` | process is alive; **always 200**                                     | the Compose healthcheck  |
| `/readyz`  | alive **and** Redis PINGs (503 if `REDIS_URL` set and Redis is down) | the poller's deploy gate |

```sh
curl -fsS localhost:8787/healthz          # on the VM
curl -fsS localhost:8787/readyz
curl -fsS https://api.eps.eko.in/healthz  # through nginx, from anywhere
```

**Which image is actually running.** A container's `.Image` is a local config
ID, _not_ a registry digest — resolve it through `docker image inspect` (this
is exactly what `deploy/poller/poll.sh:56` does):

```sh
cid=$(dc ps -q eps-backend)
docker image inspect "$(docker inspect "$cid" --format '{{.Image}}')" \
  --format '{{join .RepoDigests "\n"}}'
grep EPS_BACKEND_IMAGE /data/eps-backend/deploy.env   # what the poller thinks
```

**Is auto-deploy paused?**

```sh
docker run --rm -v eps-backend_eps-poller-state:/state busybox ls -la /state
```

`HOLD` present ⇒ the poller is idle by design. `last_good` holds the previous
healthy digest; `remote_fail_count` counts consecutive registry failures.
See [Clearing HOLD](./eps-backend-vm-deploy.md#clearing-hold).

---

## 4. Logs

```sh
dc logs -f --tail=100 eps-backend   # application
dc logs -f --tail=100 poller        # deploy loop, lines prefixed "<ISO> [poller]"
dc logs --tail=50 redis
```

App logs are **structured JSON on stdout** — there are no log files inside the
container, so container logs and app logs are the same stream. Pretty-print
them the way `npm run dev:pretty` does:

```sh
dc logs --tail=200 eps-backend | jq -R -r 'fromjson? // .'
```

Filter by the `type` discriminator:

| `type`             | Source                     | Contents                                      |
| ------------------ | -------------------------- | --------------------------------------------- |
| `access`           | `src/audit/accessLog.ts`   | rid, method, path, status, durMs, ip          |
| `security_audit`   | `src/audit/securityLog.ts` | admin login / mutation, granted vs denied     |
| `eko_upstream`     | `src/audit/ekoLog.ts`      | SimpliBank calls (verbosity: `EKO_LOG_LEVEL`) |
| `connect_upstream` | `src/audit/ekoLog.ts`      | connect-api calls                             |

```sh
# server errors in the last hour
dc logs --since 1h eps-backend | jq -Rc 'fromjson? // empty
  | select(.type=="access" and .status>=500)'

# admin actions that were denied
dc logs --since 24h eps-backend | jq -Rc 'fromjson? // empty
  | select(.type=="security_audit" and .granted==false)'
```

`/healthz` and `/readyz` are deliberately excluded from access logging, so
their absence is not a bug.

Plain-text (non-JSON) lines worth grepping:

```
[eps-backend] listening on :8787
[eps-backend] KV backend: redis | in-memory
[eps-backend] unhandled
[eps-backend] fatal startup error
Missing required env vars: …
```

**Rotation is already handled** — all three services use the `json-file` driver
with `max-size: 10m`, `max-file: 5`. No logrotate config needed. Host files sit
under `/data/docker/containers/<id>/*-json.log`.

---

## 5. Restart & recreate

```sh
dc restart eps-backend        # same image, same env — bounces the process
dc up -d --no-deps --force-recreate eps-backend   # picks up .env changes
dc up -d                      # reconcile the whole stack
dc down                       # stop + remove containers; NAMED VOLUMES SURVIVE
```

> **Destructive:** `dc down -v` also deletes `eps-backend_eps-redis-data` — every
> refresh token and stored GitHub token goes with it, forcing a mass re-login.
> There is almost never a reason to use it in production.

`dc config -q` validates **Compose-level** resolution only — YAML syntax,
variable interpolation, mount and network references. It does **not** check
that the application's required variables are present, that `KV_ENCRYPTION_KEY`
decodes to 32 bytes, or that any URL is well-formed. Only a real boot does that
(see §6).

Pausing auto-deploy while you work by hand:

```sh
docker run --rm -v eps-backend_eps-poller-state:/state busybox touch /state/HOLD
```

Clear it afterwards — [Clearing HOLD](./eps-backend-vm-deploy.md#clearing-hold).

---

## 6. Changing `.env` safely

Config is read **once at boot** (`loadConfig(process.env)` inside `buildApp()`).
There is no SIGHUP and no reload — only `SIGTERM`/`SIGINT` graceful shutdown.
So an `.env` edit needs a container recreate, and recreating the single backend
container is a brief outage. Prove the new config boots _before_ touching the
live one.

```sh
# 1. Stop the poller racing you (it can recreate the backend mid-edit)
docker run --rm -v eps-backend_eps-poller-state:/state busybox touch /state/HOLD

# 2. Back up and edit
cp -a /data/eps-backend/.env /data/eps-backend/.env.bak
vi /data/eps-backend/.env && chmod 600 /data/eps-backend/.env

# 3. Compose-level sanity (syntax/interpolation only — see §5)
dc config -q

# 4. PREFLIGHT: boot a throwaway container on the new env, don't publish a port
docker run --rm --network eps-backend_eps-internal \
  --env-file /data/eps-backend/.env \
  "$(grep -oP '(?<=^EPS_BACKEND_IMAGE=).*' /data/eps-backend/deploy.env)"
#    expect: [eps-backend] listening on :8787   → Ctrl-C
#    a bad config aborts here with "Missing required env vars: …" and the
#    live container is still untouched

# 5. Apply
dc up -d --no-deps --force-recreate eps-backend
dc logs --tail=50 eps-backend
curl -fsS localhost:8787/readyz

# 6. Resume auto-deploy
docker run --rm -v eps-backend_eps-poller-state:/state busybox rm -f /state/HOLD
```

If step 5 goes wrong: `cp -a /data/eps-backend/.env.bak /data/eps-backend/.env`
and repeat step 5.

Adding `POLLER_ALERT_WEBHOOK` (or any poller knob) needs the poller recreated
too: `dc up -d --no-deps --force-recreate poller`.

**Boot-fatal variables** (`src/config.ts`, the `REQUIRED` array) — any one
missing aborts startup:

`JWT_SECRET`, `SIMPLIBANK_API_HOST`, `SIMPLIBANK_API_PORT`,
`SIMPLIBANK_API_PATH`, `EKO_DEVELOPER_KEY`, `GITHUB_CLIENT_ID`,
`GITHUB_CLIENT_SECRET`, `GITHUB_CALLBACK_URL`, `GITHUB_REPO`

Also boot-fatal, conditionally:

- `KV_ENCRYPTION_KEY` whenever `REDIS_URL` is set — must base64-decode to
  **exactly 32 bytes**.
- `SIMPLIBANK_API_SCHEME=http` against a non-loopback host without
  `SIMPLIBANK_ALLOW_INSECURE_HTTP=true`.
- A malformed `SIMPLIBANK_HISTORY_API_*` URL, a non-https non-loopback
  `CONNECT_API_BASE_URL`, or `CONNECT_ORG_ID < 1`.

Rotating `KV_ENCRYPTION_KEY` makes every stored `rt:*` and `ghtoken:*` value
undecryptable — see
[`KV_ENCRYPTION_KEY` stability](./eps-backend-vm-deploy.md#kv_encryption_key-stability)
and §7 below. `.env.example` documents every optional variable inline.

---

## 7. Redis / Valkey

The service is named `redis` but the image is Valkey 8; the CLI is `valkey-cli`.
Each `dc exec` is one command — they don't chain.

```sh
dc exec redis valkey-cli ping
dc exec redis valkey-cli dbsize
dc exec redis valkey-cli info keyspace
dc exec redis valkey-cli info memory | grep used_memory_human
dc exec redis valkey-cli --scan --pattern 'rt:*' | wc -l    # active sessions
```

**Backup** (Valkey-coordinated, not a live file copy). `SAVE` is synchronous
and blocks the server briefly; it guarantees the RDB on disk is consistent
before the tar runs:

```sh
dc exec redis valkey-cli save
mkdir -p /data/backups
docker run --rm \
  -v eps-backend_eps-redis-data:/d:ro \
  -v /data/backups:/b \
  busybox tar czf "/b/eps-redis-$(date +%F-%H%M).tgz" -C /d .
```

Take one before any Valkey major upgrade — the Redis 7 → Valkey 8 data
migration is one-way.

> **Destructive:** flushing token keys after a `KV_ENCRYPTION_KEY` rotation logs
> everyone out. Both prefixes must go — `rt:*` alone leaves undecryptable
> GitHub tokens behind. Run it _inside_ the container so the pipeline's tail
> isn't a host binary that doesn't exist:
>
> ```sh
> dc exec redis sh -c "valkey-cli --scan --pattern 'rt:*' | xargs -r valkey-cli del"
> dc exec redis sh -c "valkey-cli --scan --pattern 'ghtoken:*' | xargs -r valkey-cli del"
> ```

Redis sits on `eps-internal` only — it has no route out and no published port.
That is intentional; reach it through `dc exec`, never by exposing it.

---

## 8. Capacity

The vfs storage driver copies whole filesystems per layer instead of sharing
them, so `/data` fills far faster than image sizes suggest.

```sh
df -h /data
docker system df
docker image prune -f          # untagged/dangling only, safe to run anytime
```

The runbook's [image pruning](./eps-backend-vm-deploy.md#image-pruning) section
prescribes the daily cron — check it exists before doing this by hand.

---

## 9. Triage

| Symptom                                               | First checks                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| nginx returns 502                                     | `dc ps` (is the backend up?), `curl -fsS localhost:8787/healthz` (is the upstream reachable?), `dc logs --tail=100 eps-backend`, then `systemctl status nginx` + `/var/log/nginx/error.log`. Only after a _verified_ nginx config change: `nginx -t && systemctl reload nginx` — reload, never restart. |
| container restart-looping                             | `dc logs --tail=100 eps-backend` → look for `Missing required env vars`, `fatal startup error`. `dc ps` shows `RestartCount` climbing.                                                                                                                                                                  |
| new image never deploys                               | `dc logs --tail=100 poller`. Check `/state/HOLD` (§3), `remote_fail_count` (registry auth/connectivity), and that `.ghcr-auth.json` still has a valid GHCR token.                                                                                                                                       |
| `/readyz` 503 but `/healthz` 200                      | Redis is down or unreachable: `dc ps redis`, `dc exec redis valkey-cli ping`.                                                                                                                                                                                                                           |
| every client looks like one IP; rate limiter misfires | nginx must **overwrite** `X-Real-IP` (`proxy_set_header X-Real-IP $remote_addr`) — see README, [Reverse proxy requirement](../README.md#reverse-proxy-requirement).                                                                                                                                     |
| deploy fired, then rolled itself back                 | `dc logs poller` for the health-gate failure, `/state/last_good` for the digest it reverted to. To pin a specific image by hand: [Manual rollback](./eps-backend-vm-deploy.md#manual-rollback).                                                                                                         |
| CI green but no deploy ran                            | `deploy-eps-backend.yml` only fires on `workflow_run` of CI on `main`, and skips when nothing under `packages/eps-backend/**` changed.                                                                                                                                                                  |

---

## 10. Local dev

Docker is **not** the normal local loop — the backend runs fine on the host:

```sh
npm run backend:dev                            # from the repo root
npm run dev:pretty -w @ekoindia/eps-backend    # same, JSON logs through jq
```

If you do need the container (verifying the image build, or the nested-`jose`
dependency layout):

```sh
# from the REPO ROOT — the Dockerfile copies the root package.json + lockfile,
# so the build context must be the root, not packages/eps-backend
docker compose -f packages/eps-backend/docker-compose.yml up --build
```

Two things that file deliberately leaves to you:

- It sets only `REDIS_URL` and `KV_ENCRYPTION_KEY`. The backend still needs
  every variable in §6 or it aborts at boot — add `env_file: - .env` to the
  `eps-backend` service (and keep it out of commits).
- The `ports:` block is commented out, so nothing is reachable on 8787 until
  you uncomment it.

Before touching the deploy poller:

```sh
npm run test:poller -w @ekoindia/eps-backend   # bash shim tests for poll.sh
shellcheck packages/eps-backend/deploy/poller/poll.sh
```

Both also run in CI.

---

## See also

- [VM deploy runbook](./eps-backend-vm-deploy.md) — bootstrap, rollback, HOLD, alerts
- [Poller README](../deploy/poller/README.md) — reusing the sidecar for another project
- [eps-backend README](../README.md) — endpoints, auth providers, KV tiers, log schemas
