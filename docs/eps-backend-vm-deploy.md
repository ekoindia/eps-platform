# eps-backend — Production VM Deploy Runbook

Pull-based auto-deploy for `ghcr.io/ekoindia/eps-backend` on a single private
VM. A poller container watches the `:prod` tag in GHCR and reconciles the
running image every 30 seconds, with a health gate and automatic rollback.

---

## Contents

1. [Bootstrap](#bootstrap)
2. [How a deploy happens](#how-a-deploy-happens)
3. [Manual rollback](#manual-rollback)
4. [Clearing HOLD](#clearing-hold)
5. [Alerts](#alerts)
6. [Ongoing ops](#ongoing-ops)

---

## Bootstrap

Complete these steps once, in order, before the poller starts managing the
stack.

### Step 1 — Install Docker Engine and the Compose plugin

Follow the official Docker Engine installation guide for your distro (Ubuntu
example: `apt-get install docker-ce docker-ce-cli containerd.io
docker-buildx-plugin docker-compose-plugin`). Verify:

	docker version
	docker compose version

Both commands must succeed. Ensure the Docker daemon starts on boot
(`systemctl enable --now docker`).

### Step 2 — Synchronise the clock (NTP)

Digest comparisons and JWT validation are time-sensitive. Enable and start an
NTP client before anything else:

	timedatectl set-ntp true
	timedatectl status          # confirm "System clock synchronized: yes"

### Step 3 — Copy the deploy directory to the VM

Place the contents of `packages/eps-backend/` (which includes
`docker-compose.prod.yml` and `deploy/poller/`) at `/deploy` on the VM so the
invariant compose command can find the file:

	/deploy/docker-compose.prod.yml
	/deploy/deploy/poller/          # poller Dockerfile + poll.sh

Ownership and permissions: the files need to be readable by the user running
Docker. On most setups `root` or a `docker` group member is fine.

### Step 4 — Log in to GHCR

The `ghcr.io/ekoindia/eps-backend` image is private. The user running Docker
must authenticate before the poller can pull:

	docker login ghcr.io

Use a GitHub Personal Access Token (PAT) with `read:packages` scope as the
password, or a machine account token. The credentials are written to
`~/.docker/config.json`.

The poller container authenticates to the private registry for skopeo digest
checks by mounting the host's `~/.docker/config.json` read-only into the
container at `/root/.docker/config.json` and setting `REGISTRY_AUTH_FILE`
to that path. The `docker compose pull` path goes through the Docker socket
and already uses the host daemon's auth context.

**Important:** `docker login` must store a plain base64 token directly in
`config.json`. If a credential helper (`credStore` or `credHelpers`) is
configured, `config.json` contains no `auth` entry and the mounted file is
useless to skopeo. Run `docker login ghcr.io` on the VM and confirm that
`~/.docker/config.json` contains an `"auths"` entry with an `"auth"` field
for `ghcr.io`.

### Step 5 — Create `/deploy/.env` with production secrets

Copy `.env.example` to `/deploy/.env` and fill in all required values:

	cp /deploy/.env.example /deploy/.env
	$EDITOR /deploy/.env

At minimum you need `JWT_SECRET`, the `SIMPLIBANK_*` and `EKO_*` variables,
`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_CALLBACK_URL`,
`GITHUB_REPO`, `REDIS_URL`, and `KV_ENCRYPTION_KEY`. See `.env.example` for
the full list and inline notes. Restrict file permissions:

	chmod 600 /deploy/.env

### Step 6 — Seed `/deploy/deploy.env` with the current `:prod` digest

The poller will overwrite this file on every reconciliation, but it must exist
for the first `up -d`. Use `docker buildx imagetools` (part of the Docker
Buildx plugin already installed in Step 1) to resolve the current `:prod`
digest without pulling the image. This reuses the GHCR credentials from the
`docker login` in Step 4:

	EPS_BACKEND_IMAGE=ghcr.io/ekoindia/eps-backend@$(docker buildx imagetools inspect \
	  ghcr.io/ekoindia/eps-backend:prod --format '{{.Manifest.Digest}}')
	printf 'EPS_BACKEND_IMAGE=%s\n' "$EPS_BACKEND_IMAGE" > /deploy/deploy.env

Verify it looks like:

	EPS_BACKEND_IMAGE=ghcr.io/ekoindia/eps-backend@sha256:<64 hex chars>

### Step 7 — Bring up the stack

	docker compose -p eps-backend --project-directory /deploy \
	  --env-file /deploy/deploy.env -f /deploy/docker-compose.prod.yml up -d

Wait a few seconds, then confirm all three containers are running:

	docker compose -p eps-backend --project-directory /deploy \
	  --env-file /deploy/deploy.env -f /deploy/docker-compose.prod.yml ps

Expected: `redis`, `eps-backend`, and `poller` with status `Up` (eps-backend
will show `(healthy)` once the healthcheck passes). The backend is reachable at
`127.0.0.1:8787` — point your reverse proxy there.

---

## How a deploy happens

1. A pull request is merged into `main` (branch protection enforces CI passing
   before merge; the merge gate is therefore the deploy gate).
2. The **Deploy eps-backend** workflow (`deploy-eps-backend.yml`) triggers on
   `workflow_run` when the CI workflow completes successfully for a push to
   `main`. A stale-run guard skips the publish if the built SHA is no longer
   the tip of `origin/main` (a faster merge landed while this run was queued).
3. The workflow builds the image, pushes it tagged as `:sha`, then atomically
   repoints `:prod` at that exact digest with `docker buildx imagetools create`.
   No rebuild occurs during the retag step — the digest is canonical.
4. Within at most 30 seconds the poller calls `skopeo inspect` and detects that
   the remote `:prod` digest differs from what the running container was pulled
   from. It writes the new image reference to `/deploy/deploy.env`, pulls the
   image, and calls `docker compose up -d --no-deps eps-backend`.
5. The health gate polls `http://eps-backend:8787/readyz` up to 10 times with a
   3-second delay between attempts. Redis availability is checked in parallel.
6. If the gate passes, the poller records the digest in `/state/last_good` and
   sends an `INFO` alert.
7. If the gate fails, the poller checks whether the failure is a dependency
   fault (Redis down or the container itself crashing) or a pure image fault,
   then either holds (dependency/first-deploy) or rolls back to the previous
   known-good digest (image fault).

---

## Manual rollback

Use this procedure to pin the stack to any previously published digest,
bypassing the poller's automatic selection.

**1. Find the target digest.**

The last automatically verified digest is in the poller state volume:

	docker run --rm \
	  -v eps-backend_eps-poller-state:/state \
	  busybox cat /state/last_good

For an older digest, check the GHCR package history or your deploy logs for a
`sha256:` string.

**2. Overwrite `deploy.env` with the target image reference.**

	printf 'EPS_BACKEND_IMAGE=ghcr.io/ekoindia/eps-backend@%s\n' \
	  "sha256:<64-hex-digest>" > /deploy/deploy.env

Replace `sha256:<64-hex-digest>` with the full digest including the `sha256:`
prefix — e.g. `sha256:abc123…` (64 hex characters after the colon). The
`@sha256:` separator is mandatory; the complete image reference must be of the
form `ghcr.io/ekoindia/eps-backend@sha256:<64 hex>`.

**3. Apply with the invariant compose command.**

	docker compose -p eps-backend --project-directory /deploy \
	  --env-file /deploy/deploy.env -f /deploy/docker-compose.prod.yml \
	  up -d --no-deps eps-backend

Only `eps-backend` is recreated; `redis` and `poller` are left running.

**4. Verify.**

	curl -f http://127.0.0.1:8787/healthz && echo OK

`/healthz` is a liveness check. `/readyz` additionally checks Redis and is
what the poller gates on before recording a deploy as successful.

**5. Block future auto-deploys while investigating (optional).**

The poller will detect the next `:prod` update and attempt to deploy it (which
may re-introduce the bad image). If you need to hold the rollback in place
while investigating, set HOLD manually:

	docker run --rm \
	  -v eps-backend_eps-poller-state:/state \
	  busybox sh -c 'echo "manual hold" > /state/HOLD'

See [Clearing HOLD](#clearing-hold) when ready to resume normal operation.

---

## Clearing HOLD

HOLD is a sentinel file at `/state/HOLD` inside the `eps-poller-state` named
volume. When HOLD is set, the poller logs `HOLD set (...)` on every tick and
takes no action.

**HOLD is set automatically in three situations:**

- **Dependency fault during deploy:** Redis was down or the container was
  crash-looping when the health gate ran. The failing image is left running.
  Fix the dependency, verify Redis is reachable, then clear HOLD.
- **First-deploy image fault:** The very first deploy of an image failed the
  health gate and there is no previous known-good digest to roll back to.
  Inspect the container logs, fix the image or configuration, then clear HOLD.
- **Failed rollback:** The rollback image also failed the health gate. Both the
  new and old images are suspect. Investigate both before clearing HOLD.

**To clear HOLD and resume automatic deploys:**

	docker run --rm \
	  -v eps-backend_eps-poller-state:/state \
	  busybox rm -f /state/HOLD

Confirm the poller resumes by tailing its logs:

	docker logs -f \
	  $(docker compose -p eps-backend --project-directory /deploy \
	    --env-file /deploy/deploy.env -f /deploy/docker-compose.prod.yml \
	    ps -q poller)

You should see normal `[poller] deploying ...` or idle tick output without the
`HOLD set` message.

---

## Alerts

The poller always writes structured log lines to stderr. To also receive
webhook notifications on deploy, rollback, and fault events, add this line to
`/deploy/.env`:

	POLLER_ALERT_WEBHOOK=https://your.webhook.endpoint/path

The poller reads `/deploy/.env` via its `env_file` configuration in
`docker-compose.prod.yml`. Restart the poller after editing:

	docker compose -p eps-backend --project-directory /deploy \
	  --env-file /deploy/deploy.env -f /deploy/docker-compose.prod.yml \
	  up -d --no-deps poller

**Payload format** — the poller POSTs JSON on every alert:

	{"level":"INFO"|"WARN"|"CRIT","service":"eps-backend","message":"<text>"}

Levels: `INFO` for successful deploys; `WARN` for rollbacks and transient
issues; `CRIT` for faults that set HOLD.

**Without a webhook**, monitor the poller with:

	docker logs -f <poller-container-id>

---

## Ongoing ops

### Log rotation

Log rotation is built into the stack. All three services (`redis`, `eps-backend`,
`poller`) use the `json-file` driver with `max-size: 10m` and `max-file: 5`.
No additional log rotation configuration is needed.

### Image pruning

Old image layers accumulate on the VM after each deploy. Schedule a periodic
prune — for example, a daily cron job:

	# /etc/cron.daily/docker-image-prune
	#!/bin/sh
	docker image prune -f

Or with crontab:

	0 3 * * * docker image prune -f >> /var/log/docker-prune.log 2>&1

### `KV_ENCRYPTION_KEY` stability

`KV_ENCRYPTION_KEY` is a **stable secret**. It encrypts GitHub OAuth tokens and
refresh-token claims at rest in Redis using AES-256-GCM. Rotating this key
requires flushing all encrypted values from Redis and forcing all users to
re-authenticate — it is not a routine redeploy operation. Never rotate it
casually. If rotation is required, run the Redis key flush described in the
README's "Rollback" section (`rt:*` and `ghtoken:*` patterns) before deploying
the new key.

### Pre-merge ops (one-time human actions)

The following are not automated and must be performed manually before the
pull-based deploy pipeline is fully operational:

- **Enable branch protection on `main`:** required reviews + required CI
  (the "CI" workflow). The deploy workflow only fires on a successful CI run,
  so branch protection is what makes the merge gate the deploy gate.
- **Confirm the GHCR package is private:** `ghcr.io/ekoindia/eps-backend` must
  be set to private with repository access granted to the Actions workflow.
  This is configured in the GitHub organisation's package settings on first
  publish.
