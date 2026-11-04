import {
	buildLeadWebsiteUrl,
	getFirstVisitUrl,
} from "@/hooks/use-tracking-params";
import { ApiError, authClient } from "@/lib/auth/client";

/**
 * The signed-in partner's Zoho CRM Lead, shared by every page that reads it.
 *
 * One module-level store, read through `useCrmLead()`
 * (`@/lib/crm/use-crm-lead`). `AuthProvider` starts it as soon as a developer
 * session resolves — so the Lead is usually loaded before any page asks — and
 * clears it whenever the session ends. Same shape as the notifications store.
 *
 * ## Cache
 *
 * The Lead is parked in `localStorage` for a day, so a partner who browses the
 * site and console all day costs one Zoho read, not one per page load.
 * `localStorage` rather than IndexedDB: the payload is a few KB (only the
 * backend's field whitelist ever arrives), a synchronous read is negligible at
 * that size, and the `storage` event keeps every open tab in step for free.
 *
 * The trade, made deliberately: unlike the `/me` cache (sessionStorage), this
 * survives closing the browser. It is tagged with the owner's mobile and Lead
 * id and ignored on mismatch, cleared on every sign-out *and* whenever the app
 * finds the session expired, and dropped after its TTL.
 *
 * A save patches the cached fields in place rather than refetching. It does not
 * restart the TTL: the record as a whole is still as old as the last read.
 *
 * ## Attribution
 *
 * Whenever a Lead is served with no `First_Visited_URL` or `Source_Website`
 * and the browser kept a first landing URL, the store asks the backend to
 * record the visitor's marketing attribution (`POST /crm/lead/attribution`)
 * and merges what was written — once per Lead per page load. That replaces
 * what the Zoho Form used to capture, for Leads the console's signup creates.
 */

/** What any reader sees. */
export type CrmLeadState =
	/** No developer session, or not started yet. */
	| { status: "idle" }
	| { status: "loading" }
	| {
			status: "ok";
			/** The whitelisted Lead fields, by Zoho `api_name`; unset → null. */
			fields: Record<string, unknown>;
			/** Selectable options per writable picklist. */
			picklists: Record<string, readonly string[]>;
	  }
	/**
	 * No CRM data, deliberately: the profile links no Lead, the deployment has
	 * no Zoho credentials, or the Lead is gone. Not an error — nothing to retry.
	 */
	| { status: "none" }
	/** The CRM was unreachable. Not cached; the next start retries. */
	| { status: "error" };

/** How long a loaded Lead is served from cache. */
export const CRM_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * How long a "no CRM data" answer is cached. Shorter than a Lead: it is
 * usually a deployment without Zoho, and nobody should wait a day after the
 * credentials go in.
 */
export const CRM_NONE_TTL_MS = 60 * 60 * 1000;

const KEY = "eps.crm.lead";

/** Bumped whenever the cached shape changes; an older blob is discarded. */
const VERSION = 1;

type Cached = Extract<CrmLeadState, { status: "ok" | "none" }>;

interface Envelope {
	v: number;
	owner: string;
	leadId: string;
	fetchedAt: number;
	result: Cached;
}

/** Frozen so `useSyncExternalStore` sees a stable snapshot. */
const IDLE: CrmLeadState = Object.freeze({ status: "idle" });
const LOADING: CrmLeadState = Object.freeze({ status: "loading" });
const NONE: CrmLeadState = Object.freeze({ status: "none" });
const ERROR: CrmLeadState = Object.freeze({ status: "error" });

let state: CrmLeadState = IDLE;
let owner = "";
let leadId: string | null = null;
let fetchedAt = 0;
/**
 * Bumped by every start and reset. A response that lands after either belongs
 * to a session (or a user) that is no longer current, and is dropped.
 */
let generation = 0;
const listeners = new Set<() => void>();
let listeningToStorage = false;
/** The Lead an attribution sync is in flight for. */
let syncing: string | null = null;
/**
 * What the last attribution sync wrote, per Lead. Overlaid on later reads: a
 * refresh that started before the write landed would otherwise serve the
 * Lead without it — and, worse, cache that for a day.
 */
let synced: { leadId: string; fields: Record<string, unknown> } | null = null;

function emit(next: CrmLeadState): void {
	state = next;
	for (const listener of listeners) listener();
}

function isFresh(envelope: Envelope, now: number): boolean {
	const ttl = envelope.result.status === "ok" ? CRM_TTL_MS : CRM_NONE_TTL_MS;
	return now - envelope.fetchedAt < ttl;
}

/**
 * A stored envelope, if it is well-formed, current-version, and belongs to the
 * identity this store is serving.
 */
function parseEnvelope(raw: string | null): Envelope | null {
	if (!raw) return null;
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!parsed || typeof parsed !== "object") return null;
		const e = parsed as Partial<Envelope>;
		if (e.v !== VERSION || e.owner !== owner || e.leadId !== leadId)
			return null;
		if (typeof e.fetchedAt !== "number") return null;
		const result = e.result as Partial<Cached> | undefined;
		if (result?.status === "none") return e as Envelope;
		if (
			result?.status === "ok" &&
			result.fields &&
			typeof result.fields === "object" &&
			result.picklists &&
			typeof result.picklists === "object"
		) {
			return e as Envelope;
		}
		return null;
	} catch {
		return null;
	}
}

function readEnvelope(): Envelope | null {
	try {
		return parseEnvelope(localStorage.getItem(KEY));
	} catch {
		// Storage blocked (privacy mode). Fetching is always correct.
		return null;
	}
}

function writeEnvelope(result: Cached): void {
	if (!leadId) return;
	try {
		const envelope: Envelope = { v: VERSION, owner, leadId, fetchedAt, result };
		localStorage.setItem(KEY, JSON.stringify(envelope));
	} catch {
		// Quota or blocked storage: the store still works, it just refetches.
	}
}

function clearStorage(): void {
	try {
		localStorage.removeItem(KEY);
	} catch {
		// See readEnvelope.
	}
}

/** Adopts another tab's save or fetch for the same partner. */
function onStorage(event: StorageEvent): void {
	if (event.key !== KEY) return;
	const envelope = parseEnvelope(event.newValue);
	if (!envelope || !isFresh(envelope, Date.now())) return;
	fetchedAt = envelope.fetchedAt;
	emit(envelope.result);
}

/** `fields` with the last sync's writes filled into any still-null slot. */
function withSynced(fields: Record<string, unknown>): Record<string, unknown> {
	if (!synced || synced.leadId !== leadId) return fields;
	const merged = { ...fields };
	for (const [key, value] of Object.entries(synced.fields)) {
		merged[key] ??= value;
	}
	return merged;
}

/**
 * Records attribution on a Lead that lacks it; see *Attribution* above.
 * Best-effort: a failure leaves the Lead as it was, and the next fetch or
 * refresh tries again.
 */
function syncAttribution(fields: Record<string, unknown>): void {
	const target = leadId;
	if (!target || syncing === target || synced?.leadId === target) return;
	if (fields.First_Visited_URL != null && fields.Source_Website != null) return;
	const url = getFirstVisitUrl();
	if (!url) return;
	syncing = target;
	authClient
		.syncCrmAttribution({ url, sourceWebsite: buildLeadWebsiteUrl() })
		.then(({ updated }) => {
			if (target !== leadId) return;
			synced = { leadId: target, fields: updated };
			if (state.status !== "ok") return;
			const next: Cached = { ...state, fields: withSynced(state.fields) };
			writeEnvelope(next);
			emit(next);
		})
		.catch(() => {
			// Best-effort; see above.
		})
		.finally(() => {
			if (syncing === target) syncing = null;
		});
}

function fetchLead(): void {
	const current = generation;
	emit(LOADING);
	authClient
		.crmLead()
		.then(({ fields, picklists }) => {
			if (current !== generation) return;
			const result: Cached = {
				status: "ok",
				fields: withSynced(fields),
				picklists: picklists ?? {},
			};
			fetchedAt = Date.now();
			writeEnvelope(result);
			emit(result);
			syncAttribution(result.fields);
		})
		.catch((error: unknown) => {
			if (current !== generation) return;
			if (error instanceof ApiError && error.httpStatus === 404) {
				fetchedAt = Date.now();
				writeEnvelope(NONE as Cached);
				emit(NONE);
				return;
			}
			emit(ERROR);
		});
}

/**
 * Loads the Lead for this partner — from cache when fresh, else from the API.
 *
 * Idempotent: called by `AuthProvider` on every session change and by every
 * `useCrmLead()` mount, it does nothing while the same partner is already
 * loading or loaded. A previous failure is retried.
 * @param nextOwner - The partner's mobile; tags the cache entry.
 * @param nextLeadId - `user_detail.crm_lead_id`, or null — then no request is
 *   made, since the backend would only answer 404.
 */
export function startCrmLead(
	nextOwner: string,
	nextLeadId: string | null,
): void {
	const same = nextOwner === owner && nextLeadId === leadId;
	if (same && state.status !== "idle" && state.status !== "error") return;
	generation += 1;
	owner = nextOwner;
	leadId = nextLeadId;
	if (!leadId) {
		emit(NONE);
		return;
	}
	const cached = readEnvelope();
	if (cached && isFresh(cached, Date.now())) {
		fetchedAt = cached.fetchedAt;
		emit(cached.result);
		if (cached.result.status === "ok") syncAttribution(cached.result.fields);
		return;
	}
	fetchLead();
}

/**
 * Re-reads the Lead from the API, ignoring the cache's TTL.
 *
 * For onboarding: upstream edits the Lead as each signup step lands, so the
 * wizard calls this after every step once the profile has a Lead. When the
 * session then becomes a developer one, `startCrmLead` finds the same partner
 * already loaded and keeps this read.
 * @param nextOwner - The partner's mobile; tags the cache entry.
 * @param nextLeadId - The profile's `crm_lead_id`.
 */
export function refreshCrmLead(nextOwner: string, nextLeadId: string): void {
	generation += 1;
	owner = nextOwner;
	leadId = nextLeadId;
	fetchLead();
}

/**
 * Writes Lead fields and patches the cache with them — no refetch.
 *
 * Only call with fields that actually changed. Rejects with the API's
 * `ApiError` (400 names the field, 409 a write-once field already recorded,
 * 502 the CRM down); the cache is untouched then.
 * @param changes - Fields by Zoho `api_name`.
 */
export async function updateCrmLead(
	changes: Record<string, unknown>,
): Promise<void> {
	const current = generation;
	const { updated } = await authClient.updateCrmLead(changes);
	if (current !== generation || state.status !== "ok") return;
	const next: Cached = {
		status: "ok",
		fields: { ...state.fields, ...updated },
		picklists: state.picklists,
	};
	// fetchedAt deliberately kept: see the module comment.
	writeEnvelope(next);
	emit(next);
}

/** Drops the Lead, in memory and on disk. Called whenever a session ends. */
export function resetCrmLeadCache(): void {
	generation += 1;
	owner = "";
	leadId = null;
	fetchedAt = 0;
	syncing = null;
	synced = null;
	clearStorage();
	emit(IDLE);
}

/** `useSyncExternalStore` subscribe. Also wires cross-tab sync, once. */
export function subscribeCrmLead(listener: () => void): () => void {
	listeners.add(listener);
	if (!listeningToStorage && typeof window !== "undefined") {
		window.addEventListener("storage", onStorage);
		listeningToStorage = true;
	}
	return () => {
		listeners.delete(listener);
	};
}

/** `useSyncExternalStore` snapshot. */
export function crmLeadSnapshot(): CrmLeadState {
	return state;
}

/** Snapshot for prerendering: no session exists at build time. */
export function crmLeadServerSnapshot(): CrmLeadState {
	return IDLE;
}
