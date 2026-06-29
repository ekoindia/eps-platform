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

# Container State.Status / Restarting / RestartCount of a cid (space-separated).
# Echoes "missing false 0" if the container is gone (→ treated as unstable).
container_state() {
	docker inspect "$1" --format '{{.State.Status}} {{.State.Restarting}} {{.RestartCount}}' 2>/dev/null \
		|| printf 'missing false 0'
}

# Health gate on the freshly-deployed container $1. rc 0 = became ready.
# Sets GATE_REDIS_DOWN_SEEN / GATE_CONTAINER_UNSTABLE for fault classification.
gate() {
	local cid="$1" i st restarting rc
	GATE_REDIS_DOWN_SEEN=false
	GATE_CONTAINER_UNSTABLE=false
	for ((i = 0; i < READYZ_RETRIES; i++)); do
		redis_ping || GATE_REDIS_DOWN_SEEN=true
		read -r st restarting rc <<<"$(container_state "$cid")"
		if [ "$st" != "running" ] || [ "$restarting" = "true" ] || [ "${rc:-0}" -gt 0 ]; then
			GATE_CONTAINER_UNSTABLE=true
		fi
		curl -fsS -o /dev/null "$READYZ_URL" && return 0
		sleep "$READYZ_DELAY_SEC"
	done
	return 1
}

# Point deploy.env at $1, pull, recreate ONLY eps-backend, echo the new cid.
# rc 0 only when pull AND up succeed AND a container id results. On any failure
# rc!=0 and NOTHING is echoed — the caller MUST NOT gate the previous container
# or write last_good for an image that never came up.
deploy_image() {
	local cid
	write_deploy_env "$1" || return 1
	dc pull eps-backend >/dev/null 2>&1 || return 1
	dc up -d --no-deps eps-backend >/dev/null 2>&1 || return 1
	cid="$(dc ps -q eps-backend 2>/dev/null || true)"
	[ -n "$cid" ] || return 1
	printf '%s' "$cid"
}

# One full decide-and-act pass. Always rc 0; outcomes via side effects.
reconcile_once() {
	if is_hold; then log "HOLD set ($(cat "$(hold_path)" 2>/dev/null)); skipping"; return 0; fi
	local remote running prev cid rcid
	remote="$(remote_digest)" || { log "skopeo failed; skip tick"; return 0; }
	[ -n "$remote" ] || { log "empty remote digest; skip"; return 0; }
	running="$(running_repo_digest)" || { log "running_repo_digest failed; skip tick"; return 0; }
	[ "$remote" = "$running" ] && return 0
	if ! redis_ping; then alert WARN "redis down — deploy of $remote paused"; return 0; fi
	prev="$running"
	log "deploying $remote (prev=${prev:-none})"
	if ! cid="$(deploy_image "$IMAGE@$remote")"; then
		alert CRIT "deploy of $remote failed (pull/up error) — holding, no rollback"
		set_hold "deploy error $remote"
		return 0
	fi
	if gate "$cid"; then
		printf '%s\n' "$remote" >"$STATE_DIR/last_good" || alert WARN "could not persist last_good=$remote"
		alert INFO "deployed $remote"
		return 0
	fi
	if [ "$GATE_REDIS_DOWN_SEEN" = true ] || ! redis_ping || [ "$GATE_CONTAINER_UNSTABLE" = true ]; then
		alert CRIT "dependency fault during deploy of $remote — holding, no rollback"
		set_hold "dependency fault deploying $remote"
		return 0
	fi
	if [ -z "$prev" ]; then
		alert CRIT "first deploy of $remote failed — no rollback target; holding"
		set_hold "first-deploy image fault $remote"
		return 0
	fi
	alert WARN "image fault on $remote — rolling back to $prev"
	if ! rcid="$(deploy_image "$IMAGE@$prev")"; then
		alert CRIT "rollback deploy of $prev failed (pull/up error) — holding"
		set_hold "rollback deploy error $prev"
		return 0
	fi
	if gate "$rcid"; then
		printf '%s\n' "$prev" >"$STATE_DIR/last_good" || alert WARN "could not persist last_good=$prev"
		alert WARN "rolled back to $prev"
		return 0
	fi
	alert CRIT "rollback to $prev also failed — holding"
	set_hold "rollback to $prev failed"
	return 0
}

# --- guarded entrypoint (main added in Task 3) ---
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
	main "$@"
fi
