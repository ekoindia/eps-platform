import { IST_OFFSET_MS } from "./dashboardRange";

/**
 * `notification_type` values EMS uses. Only `NORMAL` is served to the console.
 *
 * `COMMAND` is a remote "clear cache / reload" instruction channel, and `AD` /
 * `CUSTOMER_AD` carry retailer marketing authored for Eloka's agent app. None of
 * the three belong in a developer console, and dropping them HERE rather than in
 * the browser is what keeps that content out of a partner's page entirely.
 */
const NOTIF_TYPE_NORMAL = 0;

/** Longest `qr_code` payload we will hand the browser's encoder. */
const MAX_QR_CHARS = 2048;

/** Rows kept after dedupe. Eloka's limit for the same list. */
export const MAX_NOTIFICATIONS = 50;

/** Preview lines rendered in a list row. */
const PREVIEW_LINES = 3;

/** A YouTube video id, and nothing else — not a URL, not an embed snippet. */
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/** `YYYY-MM-DD HH:mm:ss`, optionally `T`-separated, optionally without seconds. */
const IST_STAMP = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * One notification, normalized for the console.
 *
 * Everything the browser renders is validated into this shape first: upstream is
 * a legacy EMS whose fields arrive as strings, as numbers, or not at all.
 */
export interface NotificationView {
	id: number;
	title: string;
	/** The description as authored. Markdown SOURCE when `markdown` is true. */
	body: string;
	/** Plain-text opening lines, markdown stripped. What a list row shows. */
	preview: string[];
	/** Whether `body` should be rendered as markdown. */
	markdown: boolean;
	/** Poster image. HTTPS only. */
	image?: string;
	/** YouTube video id. */
	youtube?: string;
	/** Opaque payload the browser encodes into a QR code. */
	qrCode?: string;
	/** Absolute http(s) link. Relative upstream paths are dropped — see `absoluteLink`. */
	link?: string;
	linkLabel?: string;
	/** True ISO-8601 instant, converted from upstream's IST wall clock. */
	notifyTime: string;
	priority: 1 | 2 | 3;
	state: 1 | 2 | 3;
	read: boolean;
	/**
	 * Upstream had never delivered this item before this fetch
	 * (`delivery_status === 0`).
	 *
	 * The console toasts only fresh items. Without this, a partner's FIRST poll —
	 * on a brand-new browser, with no suppression record — would announce a
	 * months-old unread notification as though it had just arrived.
	 */
	fresh: boolean;
}

/** Anything, as a trimmed string. `null`/`undefined`/objects become "". */
function str(value: unknown): string {
	if (typeof value === "string") return value.trim();
	if (typeof value === "number" && Number.isFinite(value)) return String(value);
	return "";
}

/**
 * An upstream 1–3 enum, clamped.
 * @param value - Anything upstream sent.
 * @param fallback - Used when it is missing or out of range.
 */
function rank(value: unknown, fallback: 1 | 2 | 3): 1 | 2 | 3 {
	const n = Number(value);
	return n === 1 || n === 2 || n === 3 ? n : fallback;
}

/**
 * Parses upstream's timestamps, which are IST WALL CLOCKS CARRYING NO ZONE
 * (`"2021-03-05 14:00:00"`).
 *
 * `new Date(that)` reads it as the HOST's local time, so the same payload means
 * different instants on a developer's laptop and on the UTC production VM — a
 * silent 5h30m error, and the single most likely bug in this feature.
 * @param value - The upstream string.
 * @returns Epoch milliseconds, or null when it is missing or unparseable.
 */
export function parseIstStamp(value: unknown): number | null {
	const match = IST_STAMP.exec(str(value));
	if (!match) return null;
	const [, y, mo, d, h, mi, s] = match;
	const utc = Date.UTC(
		Number(y),
		Number(mo) - 1,
		Number(d),
		Number(h),
		Number(mi),
		Number(s ?? "0"),
	);
	if (!Number.isFinite(utc)) return null;
	return utc - IST_OFFSET_MS;
}

/**
 * An absolute http(s) URL, or undefined.
 *
 * Eloka's notification links are ELOKA SPA routes (`"/transaction/252/626"`).
 * Rendering one here produces a 404 inside our own site, so a relative value is
 * dropped rather than resolved. This is also what keeps `javascript:` and
 * `data:` out of an anchor the user is invited to click.
 */
function absoluteLink(value: unknown): string | undefined {
	const raw = str(value);
	if (!/^https?:\/\//i.test(raw)) return undefined;
	return raw;
}

/**
 * An HTTPS image URL, or undefined.
 *
 * Stricter than links: an `http:` image is mixed content, which a modern browser
 * blocks anyway, and it would be a silent unencrypted beacon if it loaded.
 */
function httpsImage(value: unknown): string | undefined {
	const raw = str(value);
	if (!/^https:\/\//i.test(raw)) return undefined;
	return raw;
}

/**
 * Flattens markdown to readable plain text for list rows and the toast.
 *
 * Not a parser and not sanitization — the row renders this as TEXT. It exists so
 * a markdown notification's preview reads as prose instead of `## **Heads up**`.
 * @param line - One source line.
 */
function stripMarkdown(line: string): string {
	return line
		.replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images
		.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links → label
		.replace(/^\s{0,3}(?:[#>]+|[-*+]|\d+\.)\s+/, "") // headings, quotes, bullets
		.replace(/[`*_~]/g, "")
		.trim();
}

/** The first few non-empty lines of a description, as plain text. */
function previewOf(body: string): string[] {
	return body
		.split("\n")
		.map(stripMarkdown)
		.filter((line) => line !== "")
		.slice(0, PREVIEW_LINES);
}

/** One upstream row, normalized, or null when it must not be shown. */
function normalizeOne(
	raw: Record<string, unknown>,
	now: number,
): NotificationView | null {
	// FAIL CLOSED on the type. A missing field means NORMAL (Eloka's default, and
	// what EMS omits for plain announcements), but anything present and not
	// numerically zero — including a value we cannot parse — is dropped. Treating
	// an unrecognised type as NORMAL is how an ad or a COMMAND would leak in.
	const type =
		raw.notification_type == null ? 0 : Number(raw.notification_type);
	if (!Number.isFinite(type) || type !== NOTIF_TYPE_NORMAL) return null;

	const id = Number(raw.id);
	if (!Number.isInteger(id) || id <= 0) return null;

	const notifyMs = parseIstStamp(raw.notify_time) ?? now;
	// Not yet due. EMS can hold scheduled announcements, and an early one would
	// both appear in the list and toast as though it had just been published.
	if (notifyMs > now) return null;

	const expiryMs = parseIstStamp(raw.expiry_time);
	if (expiryMs !== null && expiryMs <= now) return null;

	const body = typeof raw.desc === "string" ? raw.desc : str(raw.desc);
	const link = absoluteLink(raw.link);
	const youtube = str(raw.youtube);
	const qrCode = str(raw.qr_code);

	return {
		id,
		title: str(raw.title),
		body,
		preview: previewOf(body),
		markdown: Number(raw.markdown) === 1,
		image: httpsImage(raw.image),
		youtube: YOUTUBE_ID.test(youtube) ? youtube : undefined,
		qrCode: qrCode && qrCode.length <= MAX_QR_CHARS ? qrCode : undefined,
		link,
		// A label without a link is a button that does nothing.
		linkLabel: link ? str(raw.link_label) || undefined : undefined,
		notifyTime: new Date(notifyMs).toISOString(),
		priority: rank(raw.priority, 2),
		state: rank(raw.state, 1),
		read: Number(raw.read) === 1,
		fresh: Number(raw.delivery_status) === 0,
	};
}

/**
 * Turns an interaction-10010 envelope into the console's list.
 *
 * Deduped by `id`, NOT by content the way Eloka does: two genuinely distinct
 * announcements can share their text while differing in id and read state, and
 * collapsing them means marking one read makes the other reappear on the next
 * poll. (Eloka's content tuple is partly dead anyway — it compares freshly
 * allocated `poll` arrays with `===`.)
 *
 * Sorted newest-first EXPLICITLY: the toast rule picks the newest unread item,
 * and Eloka only ever assumed upstream's ordering.
 * @param envelope - The raw upstream envelope.
 * @param now - Epoch milliseconds, for expiry and scheduling decisions.
 * @returns The list, capped at {@link MAX_NOTIFICATIONS}.
 */
export function normalizeNotifications(
	envelope: Record<string, unknown>,
	now: number,
): NotificationView[] {
	const data = envelope.data as { notifications?: unknown } | undefined;
	const list = data?.notifications;
	if (!Array.isArray(list)) return [];

	const byId = new Map<number, NotificationView>();
	for (const entry of list) {
		if (typeof entry !== "object" || entry === null) continue;
		const view = normalizeOne(entry as Record<string, unknown>, now);
		if (view && !byId.has(view.id)) byId.set(view.id, view);
	}

	return [...byId.values()]
		.sort((a, b) => b.notifyTime.localeCompare(a.notifyTime))
		.slice(0, MAX_NOTIFICATIONS);
}
