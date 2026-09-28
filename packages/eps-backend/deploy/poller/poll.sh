#!/usr/bin/env bash
set -euo pipefail

: "${IMAGE:=ghcr.io/ekoindia/eps-backend}"
: "${WATCH_TAG:=prod}"
# Service/target knobs — defaults reproduce backend behavior exactly. A second
# stack (e.g. eps-transact-mcp) overrides these to watch a different service
# with no redis dependency, without forking this script.
: "${SERVICE:=eps-backend}"
: "${DEPLOY_ENV_KEY:=EPS_BACKEND_IMAGE}"
: "${REDIS_REQUIRED:=1}"
: "${ALERT_SERVICE:=eps-backend}"
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
: "${REMOTE_FAIL_ALERT_THRESHOLD:=5}"
# Alerts kept in $STATE_DIR/events.jsonl for dashboards (oldest dropped).
: "${EVENTS_MAX:=200}"
# How often a still-set HOLD re-announces itself. A HOLD nobody is told about is
# indistinguishable from no auto-deploy at all: one CRIT at latch time was once
# missed for five days while six merged commits sat undeployed.
: "${HOLD_REALERT_SEC:=3600}"

# The ONE invariant compose invocation (see Global Constraints).
dc() {
	docker compose -p "$COMPOSE_PROJECT" --project-directory "$PROJECT_DIR" \
		--env-file "$DEPLOY_ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

log() { printf '%s [poller] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; }

# JSON string literal for $1, or `null` when empty. ponytail: escapes \ " and
# \n \r \t only — every message is poller-authored or a one-line HOLD reason.
jstr() {
	[ -n "$1" ] || { printf 'null'; return 0; }
	local s="$1"
	s="${s//\\/\\\\}"
	s="${s//\"/\\\"}"
	s="${s//$'\n'/\\n}"
	s="${s//$'\r'/\\r}"
	s="${s//$'\t'/\\t}"
	printf '"%s"' "$s"
}
# JSON integer for $1, or `null` when it is not a plain non-negative integer.
jnum() {
	case "$1" in '' | *[!0-9]*) printf 'null' ;; *) printf '%s' "$1" ;; esac
}

# Append one JSON line to $STATE_DIR/events.jsonl, keeping the newest EVENTS_MAX.
# Never fails: a dashboard feed must not be able to break a deploy.
record_event() {
	local f="$STATE_DIR/events.jsonl" tmp
	printf '%s\n' "$1" >>"$f" 2>/dev/null || return 0
	[ "$(($(wc -l <"$f")))" -gt "$EVENTS_MAX" ] || return 0
	tmp="$(mktemp "$STATE_DIR/.events.XXXXXX" 2>/dev/null)" || return 0
	if tail -n "$EVENTS_MAX" "$f" >"$tmp" && chmod 644 "$tmp"; then
		mv -f "$tmp" "$f" || rm -f "$tmp"
	else
		rm -f "$tmp"
	fi
	return 0
}

# alert <level> <msg>: always logs and records to events.jsonl; also POSTs JSON
# when POLLER_ALERT_WEBHOOK is set. `text` makes the same payload a valid Slack /
# Google Chat / Mattermost incoming-webhook message; generic receivers read the
# structured fields.
alert() {
	local level="$1"; shift
	local msg="$*"
	log "ALERT[$level] $msg"
	record_event "{\"at\":$(date -u +%s),\"level\":$(jstr "$level"),\"service\":$(jstr "$ALERT_SERVICE"),\"message\":$(jstr "$msg")}"
	[ -n "$POLLER_ALERT_WEBHOOK" ] || return 0
	curl -fsS -m 10 -X POST -H 'Content-Type: application/json' \
		-d "{\"level\":$(jstr "$level"),\"service\":$(jstr "$ALERT_SERVICE"),\"message\":$(jstr "$msg"),\"text\":$(jstr "[$level] $ALERT_SERVICE: $msg")}" \
		"$POLLER_ALERT_WEBHOOK" >/dev/null 2>&1 || log "webhook post failed"
}

redis_ping() {
	[ "$(redis-cli -h "$REDIS_PING_HOST" -p "$REDIS_PING_PORT" ping 2>/dev/null)" = "PONG" ]
}

# Registry manifest digest of :prod, no pull. Echoes sha256:...; rc!=0 on failure.
remote_digest() {
	skopeo inspect --format '{{.Digest}}' "docker://$IMAGE:$WATCH_TAG" 2>/dev/null
}

# Local image id of the LIVE $SERVICE container. Empty if none.
running_image_id() {
	local cid
	cid="$(dc ps -q "$SERVICE" 2>/dev/null || true)"
	[ -n "$cid" ] || { printf ''; return 0; }
	docker inspect "$cid" --format '{{.Image}}' 2>/dev/null || printf ''
}

# Digest the LIVE backend container is actually running, resolved to a RepoDigest
# (container .Image is a local config id, NOT the registry digest). Empty if none.
running_repo_digest() {
	local imgid
	imgid="$(running_image_id)"
	[ -n "$imgid" ] || { printf ''; return 0; }
	docker image inspect "$imgid" --format '{{join .RepoDigests "\n"}}' 2>/dev/null \
		| grep -m1 "^${IMAGE}@sha256:" | sed "s#^${IMAGE}@##" || printf ''
}

# Git commit baked into the LIVE image (OCI revision label). Empty if none.
running_revision() {
	local imgid
	imgid="$(running_image_id)"
	[ -n "$imgid" ] || { printf ''; return 0; }
	docker image inspect "$imgid" \
		--format '{{index .Config.Labels "org.opencontainers.image.revision"}}' 2>/dev/null || printf ''
}

# Atomically point deploy.env's $DEPLOY_ENV_KEY at an image ref: temp in same
# dir, sync, rename, sync dir. rc!=0 on ANY write failure (the caller must not
# proceed to deploy a stale desired state). errexit is unreliable here (function
# runs inside an `if ! $(…)` / `||` context), so every fallible step is guarded.
# Unrelated lines in deploy.env are preserved — two stacks may share the file,
# and only this stack's key is rewritten.
write_deploy_env() {
	local ref="$1" dir tmp
	dir="$(dirname "$DEPLOY_ENV_FILE")"
	tmp="$(mktemp "$dir/.deploy.env.XXXXXX")" || return 1
	# Carry over every line except a prior pin for this key, then append the new
	# pin. grep rc=1 (no match) is expected on first write / fresh file — guard it.
	if [ -f "$DEPLOY_ENV_FILE" ]; then
		grep -v "^${DEPLOY_ENV_KEY}=" "$DEPLOY_ENV_FILE" >"$tmp" 2>/dev/null || :
	fi
	printf '%s=%s\n' "$DEPLOY_ENV_KEY" "$ref" >>"$tmp" || { rm -f "$tmp"; return 1; }
	sync "$tmp" 2>/dev/null || sync || true
	mv -f "$tmp" "$DEPLOY_ENV_FILE" || { rm -f "$tmp"; return 1; }
	sync "$dir" 2>/dev/null || sync || true
}

hold_path() { printf '%s/HOLD' "$STATE_DIR"; }
hold_stamp_path() { printf '%s/hold_alerted_at' "$STATE_DIR"; }
is_hold() { [ -f "$(hold_path)" ]; }
hold_reason() { head -n1 "$(hold_path)" 2>/dev/null || printf ''; }
# HOLD is the safety stop; if it cannot be written, say so loudly (do not swallow).
# Every caller alerts immediately before setting it, so stamp the re-alert clock
# now — a fresh incident must not inherit the previous one's throttle window, and
# must not double-alert on the very next tick either.
set_hold() {
	printf '%s\n' "$*" >"$(hold_path)" || log "FATAL: cannot write HOLD sentinel: $*"
	date -u +%s >"$(hold_stamp_path)" 2>/dev/null || :
}
clear_hold() { rm -f "$(hold_path)" "$(hold_stamp_path)"; }

# `rejected` names the one digest that failed the health gate as an IMAGE fault.
# Without it a successful rollback leaves :prod on the bad digest and the next
# tick redeploys it — a deploy/rollback loop every POLL_INTERVAL_SEC. Scoped to
# a single digest: any new :prod deploys normally and a success clears it.
rejected_path() { printf '%s/rejected' "$STATE_DIR"; }
rejected_stamp_path() { printf '%s/rejected_alerted_at' "$STATE_DIR"; }
rejected_digest() { head -n1 "$(rejected_path)" 2>/dev/null || printf ''; }
# Stamped like set_hold: the caller has just alerted.
set_rejected() {
	printf '%s\n' "$1" >"$(rejected_path)" || log "could not persist rejected=$1"
	date -u +%s >"$(rejected_stamp_path)" 2>/dev/null || :
}
clear_rejected() { rm -f "$(rejected_path)" "$(rejected_stamp_path)"; }

# record_deploy <deploy|rollback> <digest>: what went live last, and when.
record_deploy() {
	printf '%s %s %s\n' "$(date -u +%s)" "$1" "$2" >"$STATE_DIR/last_deploy" 2>/dev/null \
		|| log "could not persist last_deploy"
}

# Epoch mtime of file $1, empty if unreadable. `date -r` works on GNU, BusyBox
# and BSD alike; `stat` flags do not.
file_mtime() { date -u -r "$1" +%s 2>/dev/null || printf ''; }

# $STATE_DIR/status.json: one machine-readable snapshot for dashboards, rewritten
# atomically after every tick (schema: deploy/poller/README.md "status.json").
# World-readable so a read-only volume mount in another container can use it.
write_status() {
	local cid st=missing restarting=false restarts=0 ready=false
	local hold=null rejected=null last_deploy=null at kind digest tmp
	cid="$(dc ps -q "$SERVICE" 2>/dev/null || true)"
	[ -z "$cid" ] || read -r st restarting restarts <<<"$(container_state "$cid")"
	[ "$restarting" = true ] || restarting=false
	curl -fsS -m 5 -o /dev/null "$READYZ_URL" 2>/dev/null && ready=true
	if is_hold; then
		hold="{\"reason\":$(jstr "$(hold_reason)"),\"since\":$(jnum "$(file_mtime "$(hold_path)")")}"
	fi
	if [ -f "$(rejected_path)" ]; then
		rejected="{\"digest\":$(jstr "$(rejected_digest)"),\"since\":$(jnum "$(file_mtime "$(rejected_path)")")}"
	fi
	if read -r at kind digest <"$STATE_DIR/last_deploy" 2>/dev/null; then
		last_deploy="{\"at\":$(jnum "$at"),\"kind\":$(jstr "$kind"),\"digest\":$(jstr "$digest")}"
	fi
	tmp="$(mktemp "$STATE_DIR/.status.XXXXXX")" || return 1
	{
		printf '{"schema":1,"service":%s,"image":%s,"watch_tag":%s,' \
			"$(jstr "$ALERT_SERVICE")" "$(jstr "$IMAGE")" "$(jstr "$WATCH_TAG")"
		printf '"updated_at":%s,"poll_interval_sec":%s,' "$(date -u +%s)" "$(jnum "$POLL_INTERVAL_SEC")"
		printf '"app":{"container":%s,"restarting":%s,"restart_count":%s,"ready":%s},' \
			"$(jstr "$st")" "$restarting" "$(jnum "$restarts")" "$ready"
		printf '"running_digest":%s,"running_revision":%s,"remote_digest":%s,"last_good":%s,' \
			"$(jstr "$(running_repo_digest)")" "$(jstr "$(running_revision)")" \
			"$(jstr "${TICK_REMOTE:-}")" "$(jstr "$(head -n1 "$STATE_DIR/last_good" 2>/dev/null || true)")"
		printf '"hold":%s,"rejected":%s,"last_deploy":%s}\n' "$hold" "$rejected" "$last_deploy"
	} >"$tmp" && chmod 644 "$tmp" && mv -f "$tmp" "$STATE_DIR/status.json" || { rm -f "$tmp"; return 1; }
}

# Epoch seconds stored in stamp file $1. 0 when missing, unreadable, or not a
# plain integer — a corrupt stamp must never abort the poller under errexit.
stamp_at() {
	local v
	v="$(cat "$1" 2>/dev/null || printf '')"
	case "$v" in
		'' | *[!0-9]*) printf '0' ;;
		*) printf '%s' "$v" ;;
	esac
}

# maybe_realert <stamp-file> <level> <message>: alert at most once per
# HOLD_REALERT_SEC, measured from the stamp. `{elapsed}` in the message becomes
# the seconds since the last alert.
maybe_realert() {
	local stamp="$1" level="$2" msg="$3" now last elapsed
	now="$(date -u +%s)"
	last="$(stamp_at "$stamp")"
	# A stamp in the future (clock stepped back) would otherwise mute alerts forever.
	[ "$last" -le "$now" ] || last=0
	elapsed=$((now - last))
	[ "$elapsed" -ge "$HOLD_REALERT_SEC" ] || return 0
	alert "$level" "${msg//\{elapsed\}/$elapsed}"
	printf '%s\n' "$now" >"$stamp" 2>/dev/null || log "could not persist $stamp"
}

# Re-announce a still-set HOLD. Deliberately independent of the registry: a HOLD
# must keep nagging even while skopeo is failing, which is exactly when it is
# most likely to be ignored.
maybe_realert_hold() {
	maybe_realert "$(hold_stamp_path)" CRIT \
		"HOLD still set after {elapsed}s ($(hold_reason)) — nothing has deployed since"
}

# True when HOLD blames a deploy that demonstrably DID land: the pull/up-error
# branch reports failure whenever compose exits non-zero, including after it has
# already recreated the container on the target image. Such a HOLD pins the very
# image it claims failed and blocks every later deploy.
#
# Matched by EXACT format — the "deploy error <digest>" prefix, and a digest that
# equals the live one. Never a substring search. Every other HOLD form
# (dependency fault / first-deploy image fault / rollback …) means the live image
# never passed the health gate, so clearing those would silently skip the gate
# forever; an operator's free-text freeze has no such prefix and is left alone.
hold_is_falsified() {
	local reason want
	reason="$(hold_reason)"
	want="${reason#deploy error }"
	[ "$want" != "$reason" ] || return 1
	case "$want" in sha256:*) ;; *) return 1 ;; esac
	[ "$want" = "$(running_repo_digest)" ]
}

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
		# REDIS_REQUIRED=0 (no-redis stacks): skip the probe, leave the flag false.
		# `if` keeps this statement rc0 under errexit (the old `||` form did too).
		if [ "$REDIS_REQUIRED" = 1 ] && ! redis_ping; then GATE_REDIS_DOWN_SEEN=true; fi
		read -r st restarting rc <<<"$(container_state "$cid")"
		if [ "$st" != "running" ] || [ "$restarting" = "true" ] || [ "${rc:-0}" -gt 0 ]; then
			GATE_CONTAINER_UNSTABLE=true
		fi
		curl -fsS -o /dev/null "$READYZ_URL" && return 0
		sleep "$READYZ_DELAY_SEC"
	done
	return 1
}

# Point deploy.env at $1, pull, recreate ONLY $SERVICE, echo the new cid.
# rc 0 only when pull AND up succeed AND a container id results. On any failure
# rc!=0 and NOTHING is echoed — the caller MUST NOT gate the previous container
# or write last_good for an image that never came up.
#
# Every step is timed and its duration logged. On a vfs-storage-driver host a
# single pull can take ~20 MINUTES (no copy-on-write: each layer is a full
# recursive copy), and with the output discarded that is indistinguishable from
# a hang. The elapsed numbers say which step is slow; compose's own stderr is
# captured and echoed on failure so "deploy error <digest>" stops being the
# whole story. Capture is via command substitution, NOT a temp file — nothing
# to leak if this function is killed mid-pull.
deploy_image() {
	local cid want t0 err
	# Unchanged contract: a stale desired state is fatal. deploy.env disagreeing
	# with the live container would be undone by the next `up`.
	write_deploy_env "$1" || return 1
	want="${1#*@}"
	log "pull $want starting"
	t0=$SECONDS
	if err="$(dc pull "$SERVICE" 2>&1 >/dev/null)"; then
		log "pull ok in $((SECONDS - t0))s; recreating $SERVICE"
		t0=$SECONDS
		if err="$(dc up -d --no-deps "$SERVICE" 2>&1 >/dev/null)"; then
			cid="$(dc ps -q "$SERVICE" 2>/dev/null || true)"
			if [ -n "$cid" ]; then
				log "up ok in $((SECONDS - t0))s"
				printf '%s' "$cid"
				return 0
			fi
			log "up ok in $((SECONDS - t0))s but no container id came back"
		else
			log "up reported failure after $((SECONDS - t0))s: $(printf '%s' "$err" | tr '\n' ' ' | tail -c 300)"
		fi
	else
		log "pull reported failure after $((SECONDS - t0))s: $(printf '%s' "$err" | tr '\n' ' ' | tail -c 300)"
	fi
	# pull/up/ps can each report failure AFTER compose has already recreated the
	# container on the target image. Taking that at face value pins HOLD to an
	# image that is in fact live and blocks every later deploy — observed in
	# production, five days of silent staleness. Check reality before giving up.
	[ "$(running_repo_digest)" = "$want" ] || return 1
	cid="$(dc ps -q "$SERVICE" 2>/dev/null || true)"
	[ -n "$cid" ] || return 1
	log "deploy of $want reported failure but the container is running it — continuing to the health gate"
	printf '%s' "$cid"
}

# One full decide-and-act pass. Always rc 0; outcomes via side effects.
reconcile_once() {
	local remote running prev cid rcid n fault
	# For write_status; empty on ticks that never reach the registry (HOLD, error).
	TICK_REMOTE=""
	if is_hold; then
		if hold_is_falsified; then
			alert INFO "clearing stale HOLD ($(hold_reason)) — that image is live, so the deploy had in fact landed"
			clear_hold
		else
			maybe_realert_hold
			log "HOLD set ($(hold_reason)); skipping"
			return 0
		fi
	fi
	if ! remote="$(remote_digest)"; then
		n=$(( $(cat "$STATE_DIR/remote_fail_count" 2>/dev/null || printf '0') + 1 ))
		printf '%s\n' "$n" >"$STATE_DIR/remote_fail_count"
		if [ "$n" -eq "$REMOTE_FAIL_ALERT_THRESHOLD" ]; then
			alert WARN "remote_digest failing $n consecutive ticks — registry auth/connectivity?"
		fi
		log "skopeo failed; skip tick"
		return 0
	fi
	: >"$STATE_DIR/remote_fail_count"
	[ -n "$remote" ] || { log "empty remote digest; skip"; return 0; }
	TICK_REMOTE="$remote"
	running="$(running_repo_digest)" || { log "running_repo_digest failed; skip tick"; return 0; }
	[ "$remote" = "$running" ] && return 0
	if [ "$remote" = "$(rejected_digest)" ]; then
		maybe_realert "$(rejected_stamp_path)" WARN \
			"rejected image $remote still on :$WATCH_TAG after {elapsed}s — running ${running:-none}; push a fixed image"
		log "skip: $remote was rejected (image fault); running ${running:-none}"
		return 0
	fi
	if [ "$REDIS_REQUIRED" = 1 ] && ! redis_ping; then alert WARN "redis down — deploy of $remote paused"; return 0; fi
	prev="$running"
	log "deploying $remote (prev=${prev:-none})"
	if ! cid="$(deploy_image "$IMAGE@$remote")"; then
		alert CRIT "deploy of $remote failed (pull/up error) — holding, no rollback"
		set_hold "deploy error $remote"
		return 0
	fi
	if gate "$cid"; then
		printf '%s\n' "$remote" >"$STATE_DIR/last_good" || alert WARN "could not persist last_good=$remote"
		clear_rejected
		record_deploy deploy "$remote"
		alert INFO "deployed $remote"
		return 0
	fi
	# Only a redis outage exonerates the image. A crash-loop with redis healthy
	# is the image's fault (2026-09-28: a bundle importing bare `sqlite` sat ~12h
	# under a "dependency fault" HOLD). A host-level cause (OOM, full disk) fails
	# the rollback gate too and still ends in the "rollback … failed" HOLD.
	if [ "$GATE_REDIS_DOWN_SEEN" = true ] || { [ "$REDIS_REQUIRED" = 1 ] && ! redis_ping; }; then
		alert CRIT "dependency fault during deploy of $remote — holding, no rollback"
		set_hold "dependency fault deploying $remote"
		return 0
	fi
	fault="image fault"
	[ "$GATE_CONTAINER_UNSTABLE" = true ] && fault="image fault (container crash-looping)"
	set_rejected "$remote"
	if [ -z "$prev" ]; then
		alert CRIT "first deploy of $remote failed: $fault — no rollback target; holding"
		set_hold "first-deploy image fault $remote"
		return 0
	fi
	alert WARN "$fault on $remote — rejected; rolling back to $prev"
	if ! rcid="$(deploy_image "$IMAGE@$prev")"; then
		alert CRIT "rollback deploy of $prev failed (pull/up error) — holding"
		set_hold "rollback deploy error $prev"
		return 0
	fi
	if gate "$rcid"; then
		printf '%s\n' "$prev" >"$STATE_DIR/last_good" || alert WARN "could not persist last_good=$prev"
		record_deploy rollback "$prev"
		alert WARN "rolled back to $prev"
		return 0
	fi
	alert CRIT "rollback to $prev also failed — holding"
	set_hold "rollback to $prev failed"
	return 0
}

# --- entrypoint ---
main() {
	mkdir -p "$STATE_DIR"
	acquire_lock
	log "poller starting: IMAGE=$IMAGE:$WATCH_TAG interval=${POLL_INTERVAL_SEC}s project=$COMPOSE_PROJECT"
	# Say it out loud rather than let the operator assume alerts are wired.
	[ -n "$POLLER_ALERT_WEBHOOK" ] \
		|| alert WARN "POLLER_ALERT_WEBHOOK unset — alerts are log-only; nobody is paged when a deploy holds"
	if [ "${POLLER_ONESHOT:-0}" = "1" ]; then
		reconcile_once
		write_status || log "status.json write failed"
		return 0
	fi
	while true; do
		reconcile_once || log "reconcile error (continuing)"
		write_status || log "status.json write failed"
		sleep "$POLL_INTERVAL_SEC"
	done
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
	main "$@"
fi
