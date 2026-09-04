/**
 * The KYC document pack, cached for the surfaces that only report on it.
 *
 * Its own module rather than a third hook in `use-kyc.ts`: `AuthProvider` clears
 * this cache on sign-out, and `use-kyc.ts` imports `AuthProvider` — putting the
 * two in one file makes that a cycle.
 */

import { authClient } from "@/lib/auth/client";
import { type KycDocument, parseDocumentList } from "@/lib/connect/kyc";
import { useEffect, useState } from "react";

/**
 * How long a fetched pack stays good. Long enough that walking Home → a page →
 * Home does not re-ask upstream, short enough that a partner who uploads a
 * document and comes back sees the new state without a reload.
 */
const DOCUMENT_TTL_MS = 60_000;

// Same shape as the interaction-list cache in `interactions.ts`, plus an expiry:
// entitlements last a session, a document pack does not. `generation` is what
// makes a reset safe mid-flight — a request started before the reset resolves
// into a generation that no longer matches and is dropped rather than seeding
// the next session's cache with the last one's documents.
let documentCache: { at: number; documents: KycDocument[] } | null = null;
let documentInflight: Promise<KycDocument[] | null> | null = null;
let generation = 0;

/**
 * Fetches the document pack, sharing one request between concurrent callers and
 * holding the answer for `DOCUMENT_TTL_MS`.
 *
 * Deliberately takes no `AbortSignal`: the request is the module's, not any one
 * component's, and a caller unmounting must not cancel a fetch its siblings are
 * waiting on. Callers drop late results instead. Failures are not cached — a
 * blip should not blind the next caller for a minute.
 * @returns The parsed pack, most actionable first, or null when the session was
 *   reset while the request was in flight — those documents belong to a session
 *   that has ended, so they are neither cached nor handed back.
 */
function fetchKycDocuments(): Promise<KycDocument[] | null> {
	if (documentCache && Date.now() - documentCache.at < DOCUMENT_TTL_MS) {
		return Promise.resolve(documentCache.documents);
	}
	const started = generation;
	documentInflight ??= authClient.connectKyc
		.documents()
		.then(({ documents: raw }) => {
			if (started !== generation) return null;
			const parsed = parseDocumentList(raw);
			documentCache = { at: Date.now(), documents: parsed };
			return parsed;
		})
		.catch((err) => {
			console.warn("[connect] KYC document list fetch failed", err);
			throw err;
		})
		.finally(() => {
			documentInflight = null;
		});
	return documentInflight;
}

/**
 * Drops the cached pack. Called when the session ends, and by tests.
 *
 * Bumps the generation as well as clearing, so a request already in flight
 * cannot land on top of the cleared cache.
 */
export function resetKycDocumentCache(): void {
	documentCache = null;
	documentInflight = null;
	generation += 1;
}

/**
 * The caller's KYC document pack, for surfaces that report on it rather than act
 * on it.
 *
 * The Documents page deliberately does NOT use this: it refetches after every
 * upload and must never read a cached pack.
 * @param enabled - Whether to ask at all. False fires no request and clears any
 *   pack already held, so an account that loses entitlement — or a session that
 *   changes under the component — never keeps showing the last one's documents.
 * @returns The pack once it resolves, or null while unresolved, when disabled,
 *   and when the fetch failed. A caller that cannot tell those apart should fall
 *   back to whatever it showed before it asked.
 */
export function useKycDocuments(enabled: boolean): KycDocument[] | null {
	const [documents, setDocuments] = useState<KycDocument[] | null>(null);

	useEffect(() => {
		if (!enabled) {
			setDocuments(null);
			return;
		}
		let alive = true;
		void fetchKycDocuments()
			.then((next) => {
				if (alive) setDocuments(next);
			})
			.catch(() => {
				// Warned in the fetch. Null keeps the caller on its fallback.
				if (alive) setDocuments(null);
			});
		return () => {
			alive = false;
		};
	}, [enabled]);

	return documents;
}
