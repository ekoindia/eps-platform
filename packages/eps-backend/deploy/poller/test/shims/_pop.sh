#!/usr/bin/env bash
# Token/line poppers over $SHIM_STATE/<name>. Let a test script a per-call
# sequence that a single poll.sh run consumes across gate iterations. When the
# file is absent/empty, echo the provided default.

# __pop: pop the first WHITESPACE-delimited token (spaces or newlines), e.g.
# redis_ping="UP DOWN DOWN UP" yields UP, DOWN, DOWN, UP, then the default.
__pop() {
	local f="${SHIM_STATE:?SHIM_STATE unset}/$1" def="$2" all first rest
	[ -s "$f" ] || { printf '%s' "$def"; return; }
	all="$(cat "$f")"
	first="${all%%[[:space:]]*}"
	rest="${all#"$first"}"
	rest="${rest#"${rest%%[![:space:]]*}"}"  # ltrim leading whitespace
	printf '%s' "$rest" >"$f"
	printf '%s' "${first:-$def}"
}

# __pop_line: pop the first LINE (for multi-token records like container state
# "running false 0"). ctr_state uses this.
__pop_line() {
	local f="${SHIM_STATE:?}/$1" def="$2" first
	[ -s "$f" ] || { printf '%s' "$def"; return; }
	IFS= read -r first <"$f" || true
	tail -n +2 "$f" >"$f.tmp" && mv "$f.tmp" "$f"
	printf '%s' "${first:-$def}"
}

__record() { printf '%s\n' "$*" >>"${SHIM_STATE:?}/calls.log"; }
