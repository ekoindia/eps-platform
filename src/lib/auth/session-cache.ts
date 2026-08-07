import type { AdminView, MeView, SignupView } from "@/lib/auth/client";

/** The cached `/me` view — whichever of the three session shapes was current. */
type SessionView = MeView | AdminView | SignupView;

/**
 * Where the last resolved `/me` view is parked so a tab reload can paint the
 * signed-in shell immediately instead of a skeleton.
 *
 * `sessionStorage`, not `localStorage`, deliberately: it is scoped to the one
 * tab and dies with it, so a shared machine never carries a name across
 * browser sessions. The Connect widget already parks its tokens the same way.
 */
const KEY = "eps.session.me";

/**
 * Bumped whenever `MeView`/`Profile` changes shape. A blob written by an older
 * build is discarded rather than rendered: the fields the new UI reads may
 * simply not be in it, and a half-populated profile on screen is worse than the
 * skeleton this cache exists to skip.
 */
const VERSION = 2;

interface Envelope {
	v: number;
	me: SessionView;
}

/**
 * Whether a parsed blob is shaped like a session view we can hand to
 * `classify()`.
 *
 * This check is load-bearing, not defensive dressing: `classify()` opens with
 * `"role" in me`, and `in` throws a TypeError on a primitive. A blob of `5`,
 * `"x"` or `null` — trivially arrived at by hand-editing storage, or by a
 * truncated write — would therefore throw outside the caller's try/catch rather
 * than falling through to `anon`.
 *
 * Each branch demands the fields its own render path reads, so a structurally
 * recognizable but incomplete view is rejected here instead of painting a
 * console with `undefined` in it.
 */
function isSessionView(value: unknown): value is SessionView {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const v = value as Record<string, unknown>;
	if (v.role === "admin") return typeof v.sub === "string";
	if (v.role === "signup") return typeof v.mobile === "string";
	// A developer view. `profile` is legitimately null (a lead with no Eko
	// profile), but `state` and `mobile` drive every branch that renders one.
	return typeof v.state === "string" && typeof v.mobile === "string";
}

/**
 * Reads the cached session view for this tab.
 * @returns The view, or null when absent, unreadable, stale, or malformed.
 */
export function readCachedSession(): SessionView | null {
	try {
		const raw = sessionStorage.getItem(KEY);
		if (!raw) return null;
		const parsed: unknown = JSON.parse(raw);
		if (!parsed || typeof parsed !== "object") return null;
		const envelope = parsed as Partial<Envelope>;
		if (envelope.v !== VERSION) return null;
		return isSessionView(envelope.me) ? envelope.me : null;
	} catch {
		// Corrupt JSON, or storage blocked outright (Safari private mode). Booting
		// from `/me` is always correct — the cache is only ever an optimisation.
		return null;
	}
}

/** Parks a resolved session view for this tab's next reload. Best-effort. */
export function writeCachedSession(me: SessionView): void {
	try {
		sessionStorage.setItem(KEY, JSON.stringify({ v: VERSION, me }));
	} catch {
		// Quota exceeded, or storage unavailable. Nothing to do: the next boot
		// just waits for `/me`, which is the behaviour without this cache at all.
	}
}

/** Drops the cached view. Called whenever the session ends, however it ends. */
export function clearCachedSession(): void {
	try {
		sessionStorage.removeItem(KEY);
	} catch {
		// See writeCachedSession.
	}
}
