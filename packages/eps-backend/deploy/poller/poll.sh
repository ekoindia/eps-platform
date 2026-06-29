#!/usr/bin/env bash
set -euo pipefail

: "${IMAGE:=ghcr.io/ekoindia/eps-backend}"
: "${WATCH_TAG:=prod}"
: "${POLL_INTERVAL_SEC:=30}"
: "${READYZ_URL:=http://eps-backend:8787/readyz}"
: "${READYZ_RETRIES:=10}"
: "${READYZ_DELAY_SEC:=3}"
: "${REDIS_PING_HOST:=redis}"
: "${REDIS_PING_PORT:=6379}"
: "${COMPOSE_PROJECT:=eps-backend}"
: "${PROJECT_DIR:=/deploy}"
: "${COMPOSE_FILE:=/deploy/docker-compose.prod.yml}"
: "${DEPLOY_ENV_FILE:=/deploy/deploy.env}"
: "${STATE_DIR:=/state}"
: "${POLLER_ALERT_WEBHOOK:=}"

# The ONE invariant compose invocation (see Global Constraints).
dc() {
	docker compose -p "$COMPOSE_PROJECT" --project-directory "$PROJECT_DIR" \
		--env-file "$DEPLOY_ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

log() { printf '%s [poller] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; }

# alert <level> <msg>: always logs; also POSTs JSON when POLLER_ALERT_WEBHOOK is set.
alert() {
	local level="$1"; shift
	log "ALERT[$level] $*"
	[ -n "$POLLER_ALERT_WEBHOOK" ] || return 0
	curl -fsS -m 10 -X POST -H 'Content-Type: application/json' \
		-d "{\"level\":\"$level\",\"service\":\"eps-backend\",\"message\":\"$*\"}" \
		"$POLLER_ALERT_WEBHOOK" >/dev/null 2>&1 || log "webhook post failed"
}

redis_ping() {
	[ "$(redis-cli -h "$REDIS_PING_HOST" -p "$REDIS_PING_PORT" ping 2>/dev/null)" = "PONG" ]
}

# Registry manifest digest of :prod, no pull. Echoes sha256:...; rc!=0 on failure.
remote_digest() {
	skopeo inspect --format '{{.Digest}}' "docker://$IMAGE:$WATCH_TAG" 2>/dev/null
}

# Digest the LIVE backend container is actually running, resolved to a RepoDigest
# (container .Image is a local config id, NOT the registry digest). Empty if none.
running_repo_digest() {
	local cid imgid
	cid="$(dc ps -q eps-backend 2>/dev/null || true)"
	[ -n "$cid" ] || { printf ''; return 0; }
	imgid="$(docker inspect "$cid" --format '{{.Image}}' 2>/dev/null || true)"
	[ -n "$imgid" ] || { printf ''; return 0; }
	docker image inspect "$imgid" --format '{{join .RepoDigests "\n"}}' 2>/dev/null \
		| grep -m1 "^${IMAGE}@sha256:" | sed "s#^${IMAGE}@##" || printf ''
}

# Atomically point deploy.env at an image ref: temp in same dir, sync, rename,
# sync dir. rc!=0 on ANY write failure (the caller must not proceed to deploy a
# stale desired state). errexit is unreliable here (function runs inside an
# `if ! $(…)` / `||` context), so every fallible step is guarded explicitly.
write_deploy_env() {
	local ref="$1" dir tmp
	dir="$(dirname "$DEPLOY_ENV_FILE")"
	tmp="$(mktemp "$dir/.deploy.env.XXXXXX")" || return 1
	printf 'EPS_BACKEND_IMAGE=%s\n' "$ref" >"$tmp" || { rm -f "$tmp"; return 1; }
	sync "$tmp" 2>/dev/null || sync || true
	mv -f "$tmp" "$DEPLOY_ENV_FILE" || { rm -f "$tmp"; return 1; }
	sync "$dir" 2>/dev/null || sync || true
}

hold_path() { printf '%s/HOLD' "$STATE_DIR"; }
is_hold() { [ -f "$(hold_path)" ]; }
# HOLD is the safety stop; if it cannot be written, say so loudly (do not swallow).
set_hold() { printf '%s\n' "$*" >"$(hold_path)" || log "FATAL: cannot write HOLD sentinel: $*"; }
clear_hold() { rm -f "$(hold_path)"; }

# Single-instance guard. A second poller fails the non-blocking flock and exits 0.
acquire_lock() {
	exec 9>"$STATE_DIR/poller.lock"
	flock -n 9 || { log "another poller holds the lock; exiting"; exit 0; }
}

# --- guarded entrypoint (main added in Task 3) ---
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
	main "$@"
fi
