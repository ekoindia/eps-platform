/**
 * The stale-list fallback for "is an e-signature still owed".
 *
 * The 223 entitlement in `/transactions/wlc` is the primary signal, but that list
 * is built from the upstream token's role claim and can lag a whole session
 * behind the account. When it does, an account that still owes a signature loses
 * every way into the flow. This store asks upstream directly (interaction 300,
 * via `POST /connect/esign/pending`) and shares the answer with every surface
 * that gates on 223 — Home probes, the rail and ⌘K only read.
 *
 * Its own module, not part of `interactions.ts`: `AuthProvider` clears it on
 * sign-out, and the generation guard here is what makes that safe mid-flight.
 */

import { authClient } from "@/lib/auth/client";
import { ESIGN_ID } from "@/lib/connect/esign";
import {
	type RoleTransactionList,
	resetRoleTransactionCache,
} from "@/lib/connect/interactions";
import { useEffect, useSyncExternalStore } from "react";

/**
 * How long one answer holds. Home re-probes on every visit, so this is what
 * keeps walking Home → a page → Home from re-asking upstream each time.
 */
export const ESIGN_PENDING_TTL_MS = 30_000;

// ponytail: in-memory, this tab, this session — a full reload asks again.
let answer: { at: number; pending: boolean } | null = null;
let inflight: Promise<void> | null = null;
// Bumped on reset, so a request started under the last session is dropped
// rather than repainting the next one.
let generation = 0;

const listeners = new Set<() => void>();

/** Subscribes to answer changes. */
function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

/** The current answer: true only once upstream said an agreement is pending. */
function snapshot(): boolean {
	return answer?.pending ?? false;
}

/** Prerender has no session, so nothing is ever pending there. */
function serverSnapshot(): boolean {
	return false;
}

/**
 * Asks upstream whether an agreement is pending, unless a fresh answer is held.
 *
 * On a hit the interaction-list cache is dropped too: the backend has just
 * refreshed the session's entitlements, so the next list fetch — the one the
 * widget at `/console/transaction/223` makes on mount — can carry the real 223
 * row. Failures are not cached and leave the last answer standing.
 */
export function probeEsignPending(): Promise<void> {
	if (answer && Date.now() - answer.at < ESIGN_PENDING_TTL_MS) {
		return Promise.resolve();
	}
	const started = generation;
	inflight ??= authClient.connectEsign
		.pending()
		.then(({ pendingCount }) => {
			if (started !== generation) return;
			const pending = pendingCount > 0;
			if (pending) resetRoleTransactionCache();
			answer = { at: Date.now(), pending };
			for (const listener of listeners) listener();
		})
		.catch((err) => {
			console.warn("[connect] pending-agreement check failed", err);
		})
		.finally(() => {
			// A reset mid-flight already cleared this; don't clear the next
			// session's request.
			if (started === generation) inflight = null;
		});
	return inflight;
}

/** Drops the held answer. Called when the session ends, and by tests. */
export function resetEsignPendingCache(): void {
	answer = null;
	inflight = null;
	generation += 1;
	for (const listener of listeners) listener();
}

/**
 * Whether the partner still owes an e-signature: the 223 entitlement, or —
 * when a stale list lacks it — upstream's own pending-agreement answer.
 * @param list - The caller's interaction list, or null while unresolved.
 * @param probe - True only on the surface that decides to ask (Home's Next
 *   Steps card, under its own preconditions). Every other caller just reads.
 * @returns True when the Sign Documents way in should be shown.
 */
export function useEsignPending(
	list: RoleTransactionList | null,
	probe = false,
): boolean {
	const fallback = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
	useEffect(() => {
		if (probe) void probeEsignPending();
	}, [probe]);
	return Boolean(list?.[String(ESIGN_ID)]) || fallback;
}
