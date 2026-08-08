import { ApiError, authClient } from "@/lib/auth/client";
import { useSyncExternalStore } from "react";
import { toast } from "sonner";

/**
 * How often the list is re-fetched while a developer session is open.
 *
 * Ten minutes, matching Eloka. There is no push channel yet — see
 * `docs/features/notifications.md` for the Phase 2 sketch.
 */
export const POLL_MS = 600_000;

/** Toast lifetime for a high-priority item, and for everything else. */
const TOAST_HIGH_MS = 30_000;
const TOAST_MS = 8_000;

/** `priority` at or above which an item is treated as high priority. */
const PRIORITY_HIGH = 3;

/** Where the last-announced item is remembered, so a reload does not re-toast. */
const TOAST_KEY = "eps.notif.last";

/**
 * One notification, as the backend hands it over.
 *
 * Declared here rather than imported from the backend package, the same way
 * `DashboardView` is: the browser bundle does not depend on the server's source
 * tree. `packages/eps-backend/src/http/notificationsView.ts` is the twin, and
 * its tests pin every field's validation.
 */
export interface NotificationView {
	id: number;
	title: string;
	/** The description as authored. Markdown source when `markdown` is true. */
	body: string;
	/** Plain-text opening lines, markdown stripped. What a list row shows. */
	preview: string[];
	markdown: boolean;
	image?: string;
	/** YouTube video id. */
	youtube?: string;
	/** Opaque payload to encode into a QR code. */
	qrCode?: string;
	link?: string;
	linkLabel?: string;
	/** ISO-8601 instant. */
	notifyTime: string;
	priority: 1 | 2 | 3;
	state: 1 | 2 | 3;
	read: boolean;
	/** Upstream had never delivered this item before the fetch that carried it. */
	fresh: boolean;
}

/**
 * The empty list, as ONE frozen value.
 *
 * `useSyncExternalStore` compares snapshots by identity: returning a fresh `[]`
 * on every read makes React re-render forever, and it would do so during SSG
 * prerender — breaking the build rather than a page.
 */
const EMPTY: readonly NotificationView[] = Object.freeze([]);

// ponytail: in-memory, this tab, this session. Cleared by AuthProvider when the
// session goes anon, and again whenever the signed-in identity changes.
let cache: readonly NotificationView[] | null = null;
let inflight: Promise<void> | null = null;
// Bumped by everything that supersedes an in-flight fetch, so a response that
// lands after a sign-out cannot repaint the next user's session with the
// previous user's list.
let version = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let userKey = "";
let lastFetchAt = 0;
/** Set once a terminal error says this deployment/account will never answer. */
let stopped = false;

const listeners = new Set<() => void>();

function emit(): void {
	for (const listener of listeners) listener();
}

/** Subscribes to list changes. */
export function subscribeNotifications(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

/**
 * Listeners waiting to be told to show the whole list.
 *
 * The panel belongs to the header bell, and the thing that asks for it — the
 * console card's "View all" — is a sibling in a different subtree. A channel here
 * is how one reaches the other without either importing the other, and without
 * lifting the popover's open state into a context only two components read.
 */
const panelListeners = new Set<() => void>();

/**
 * Subscribes to "show the full list" requests. The bell listens.
 * @param listener - Called when something asks for the panel.
 * @returns An unsubscribe function.
 */
export function subscribeNotificationPanel(listener: () => void): () => void {
	panelListeners.add(listener);
	return () => {
		panelListeners.delete(listener);
	};
}

/** Asks whichever bell is mounted to open its panel. */
export function requestNotificationPanel(): void {
	for (const listener of panelListeners) listener();
}

/** The current list. Always the same reference until something changes it. */
export function notificationsSnapshot(): readonly NotificationView[] {
	return cache ?? EMPTY;
}

/** Prerender and SSR have no session and never poll. */
function serverSnapshot(): readonly NotificationView[] {
	return EMPTY;
}

/** Re-fetches when a backgrounded tab comes back after a missed tick. */
function onVisibilityChange(): void {
	if (!document.hidden && Date.now() - lastFetchAt >= POLL_MS) void poll();
}

function stopTimer(): void {
	if (timer) clearInterval(timer);
	timer = null;
	if (typeof document !== "undefined") {
		document.removeEventListener("visibilitychange", onVisibilityChange);
	}
}

/**
 * Drops everything this tab knows about notifications and stops polling.
 *
 * Called when the session goes anon, when the signed-in identity changes, and by
 * tests.
 */
export function resetNotificationsCache(): void {
	stopTimer();
	cache = null;
	inflight = null;
	stopped = false;
	userKey = "";
	lastFetchAt = 0;
	version++;
	emit();
}

/** Reads the last-announced `{ user, id }` pair, tolerating a hostile store. */
function readAnnounced(): { u: string; id: number } | null {
	// ponytail: localStorage throws outright in Safari private mode, and the
	// stored blob is two scalars. Not worth a shared helper for one caller.
	try {
		const raw = localStorage.getItem(TOAST_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as { u?: unknown; id?: unknown };
		if (typeof parsed?.u !== "string" || typeof parsed?.id !== "number") {
			return null;
		}
		return { u: parsed.u, id: parsed.id };
	} catch {
		return null;
	}
}

function writeAnnounced(id: number): void {
	try {
		localStorage.setItem(TOAST_KEY, JSON.stringify({ u: userKey, id }));
	} catch {
		// A tab that cannot remember will re-toast after a reload. Acceptable; a
		// storage failure must not break the poll.
	}
}

/**
 * Announces the newest unread item, at most once per item per user.
 *
 * The newest UNREAD item, not `items[0]`: Eloka reads index zero and therefore
 * says nothing at all whenever the newest notification happens to be read and an
 * older one is not.
 *
 * Only `fresh` items are announced — ones upstream had never delivered before.
 * Without that, a partner's first-ever poll would pop a months-old unread
 * notification as though it had just been published.
 * @param items - The list just fetched.
 */
function announce(items: readonly NotificationView[]): void {
	const newest = items.find((item) => !item.read);
	if (!newest) return;

	const announced = readAnnounced();
	// The pair means "already dealt with", so it is written even when the item is
	// suppressed for being stale — otherwise every poll re-examines it.
	if (announced?.u === userKey && announced.id === newest.id) return;
	writeAnnounced(newest.id);
	if (!newest.fresh) return;

	// ponytail: informational only. Click-through into the detail dialog would
	// need an open-request channel from here into whichever NotificationBell is
	// mounted; add it if anyone asks.
	toast(newest.title, {
		id: `notif-${newest.id}`,
		description: newest.preview[0],
		duration: newest.priority >= PRIORITY_HIGH ? TOAST_HIGH_MS : TOAST_MS,
	});
}

/**
 * Fetches the list, sharing one request between concurrent callers.
 *
 * A 501 (no connect-api on this deployment) or a 403 (not a developer session)
 * is terminal: the list settles empty, the timer stops, and the bell simply
 * never appears. Anything else keeps the previous list and keeps polling — a
 * blinked request should not blank a bell that was correct a minute ago.
 */
function poll(): Promise<void> {
	if (inflight) return inflight;
	const startedAt = version;
	// Started off a resolved promise so a SYNCHRONOUS throw from the client lands
	// in the `.catch` below. `startNotificationsPolling` is called from an effect
	// in `AuthProvider`, and a throw on that path takes the whole provider — and
	// therefore the signed-in shell — down with it.
	inflight = Promise.resolve()
		.then(() => authClient.notifications())
		.then(({ notifications }) => {
			// A reset landed while this was in the air. This answer predates it.
			if (version !== startedAt) return;
			cache = notifications;
			lastFetchAt = Date.now();
			announce(notifications);
			emit();
		})
		.catch((e: unknown) => {
			if (version !== startedAt) return;
			if (
				e instanceof ApiError &&
				(e.httpStatus === 501 || e.httpStatus === 403)
			) {
				cache = EMPTY;
				stopped = true;
				stopTimer();
				emit();
				return;
			}
			console.warn(
				`[notifications] poll failed: ${e instanceof Error ? e.message : String(e)}`,
			);
		})
		.finally(() => {
			inflight = null;
		});
	return inflight;
}

/**
 * Starts the poll for a signed-in developer. Safe to call on every render pass.
 *
 * Compares the identity rather than merely checking for a running timer: an
 * account switch inside one tab need not pass through `anon` (an `adopt()` after
 * a fresh OTP verify does not), and without this the second user would inherit
 * the first user's list and their suppression record.
 * @param key - A stable per-user key; the Eko user id, or the mobile.
 */
export function startNotificationsPolling(key: string): void {
	if (key !== userKey) resetNotificationsCache();
	userKey = key;
	if (timer || stopped) return;

	void poll();
	// A hidden tab is throttled by the browser but never stopped, so skipping its
	// ticks is free; `onVisibilityChange` is what makes skipping them safe.
	timer = setInterval(() => {
		if (!document.hidden) void poll();
	}, POLL_MS);
	document.addEventListener("visibilitychange", onVisibilityChange);
}

/**
 * Marks one notification read, locally first.
 *
 * There is no rollback on failure — the next poll is the correcting authority,
 * and un-reading an item the user just read on screen is a worse lie than a
 * bubble that reappears. A failure does schedule one immediate reconciliation,
 * so the optimistic state cannot sit uncorrected until the next tick.
 * @param id - The notification id.
 */
export function markNotificationRead(id: number): void {
	const current = cache;
	const item = current?.find((entry) => entry.id === id);
	if (!current || !item || item.read) return;

	cache = current.map((entry) =>
		entry.id === id ? { ...entry, read: true } : entry,
	);
	emit();

	void authClient.markNotificationRead(id).catch((e: unknown) => {
		console.warn(
			`[notifications] read ${id}: ${e instanceof Error ? e.message : String(e)}`,
		);
		// Only for a transient failure. After a terminal one the endpoint is known
		// not to answer, and retrying it is the retry loop `stopped` exists to
		// prevent.
		if (!stopped) void poll();
	});
}

/** The current list and its unread count, re-rendering on every change. */
export function useNotifications(): {
	items: readonly NotificationView[];
	unread: number;
} {
	const items = useSyncExternalStore(
		subscribeNotifications,
		notificationsSnapshot,
		serverSnapshot,
	);
	let unread = 0;
	for (const item of items) if (!item.read) unread++;
	return { items, unread };
}
