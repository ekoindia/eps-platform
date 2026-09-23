import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { safeLocalStorage, safeSessionStorage } from "@/lib/ssr-safe";

/** Exact ad-platform keys that don't follow a prefix convention */
const TRACKING_EXACT = new Set([
	"gclid",
	"gbraid",
	"wbraid", // Google Ads click IDs
	"fbclid",
	"msclkid",
	"ttclid",
	"twclid",
	"li_fat_id", // other ad platforms
	"campaign_name",
	"adgroup",
	"matchtype",
	"network",
	"keyword",
]);

/** Prefix families: utm_* (utm_source, utm_adgroup, …), gad_*, gcl_* */
const TRACKING_PREFIXES = ["utm_", "gad_", "gcl_"];

const STORAGE_KEY = "eps_tracking_params";
const CALC_STORAGE_KEY = "eps_calc_selection";

/** How long first-touch attribution lives in localStorage. */
export const TRACKING_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** localStorage envelope: params + when first captured (for expiry). */
interface TrackingEnvelope {
	params: Record<string, string>;
	capturedAt: number;
}

/** Max length of the Zoho CRM "Website" field */
const CRM_URL_MAX_LEN = 450;

/**
 * Returns true for ad/attribution query params (Google Ads, UTM, Meta, etc.)
 * that must be preserved across navigation and captured on leads.
 * @param key - Query parameter name.
 */
export const isTrackingParam = (key: string): boolean => {
	const lower = key.toLowerCase();
	return (
		TRACKING_EXACT.has(lower) ||
		TRACKING_PREFIXES.some((prefix) => lower.startsWith(prefix))
	);
};

/**
 * Reads the live (unexpired) envelope, or null. Drops an expired or malformed
 * one so the next landing with tracking params starts a fresh 30-day window.
 * One-time migration: a legacy sessionStorage record (pre-localStorage) is
 * adopted as a fresh envelope when no live one exists.
 */
function readEnvelope(): TrackingEnvelope | null {
	try {
		const raw = safeLocalStorage.getItem(STORAGE_KEY);
		if (raw) {
			const parsed = JSON.parse(raw) as Partial<TrackingEnvelope>;
			if (
				parsed &&
				typeof parsed.capturedAt === "number" &&
				parsed.params &&
				typeof parsed.params === "object" &&
				parsed.capturedAt + TRACKING_TTL_MS > Date.now()
			) {
				return { params: parsed.params, capturedAt: parsed.capturedAt };
			}
			safeLocalStorage.removeItem(STORAGE_KEY);
		}
		const legacy = safeSessionStorage.getItem(STORAGE_KEY);
		if (legacy) {
			safeSessionStorage.removeItem(STORAGE_KEY);
			const params = JSON.parse(legacy) as Record<string, string>;
			if (params && typeof params === "object" && Object.keys(params).length) {
				const envelope = { params, capturedAt: Date.now() };
				safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
				return envelope;
			}
		}
	} catch {
		safeLocalStorage.removeItem(STORAGE_KEY);
	}
	return null;
}

/**
 * Captures tracking params from a query string into localStorage.
 * First-touch: stored values win over later ones, and the expiry clock
 * starts when the envelope is first created, not on every visit.
 * @param search - `location.search` (with or without leading `?`).
 */
export function captureTrackingParams(search: string): void {
	const captured: Record<string, string> = {};
	new URLSearchParams(search).forEach((value, key) => {
		if (value && isTrackingParam(key)) captured[key] = value;
	});
	if (Object.keys(captured).length === 0) return;
	// ponytail: a tab left open on an attributed URL past expiry re-captures
	// the same ids and restarts the clock; needs a "seen" marker if it matters.
	const live = readEnvelope();
	safeLocalStorage.setItem(
		STORAGE_KEY,
		JSON.stringify({
			params: { ...captured, ...live?.params },
			capturedAt: live?.capturedAt ?? Date.now(),
		}),
	);
}

/**
 * Call once at app root (inside BrowserRouter).
 * 1. Captures any tracking/UTM params from the URL into localStorage
 *    (first-touch attribution — stored values win over later ones; expires
 *    after `TRACKING_TTL_MS`).
 * 2. Re-appends stored params to the URL after every internal navigation,
 *    so Zoho SalesIQ (which records the page URL) always sees them, no
 *    matter which Link/navigation dropped them.
 */
export function useCaptureTrackingParams() {
	const { pathname, search, hash } = useLocation();
	const navigate = useNavigate();

	useEffect(() => {
		const params = new URLSearchParams(search);
		captureTrackingParams(search);

		// Re-append stored params missing from the current URL
		const stored = getStoredTrackingParams();
		let changed = false;
		Object.entries(stored).forEach(([key, value]) => {
			if (!params.has(key)) {
				params.set(key, value);
				changed = true;
			}
		});
		if (changed) {
			navigate(
				{ pathname, search: `?${params.toString()}`, hash },
				{ replace: true, preventScrollReset: true },
			);
		}
	}, [pathname, search, hash, navigate]);
}

/** Returns unexpired tracking params saved from the landing URL, or `{}`. */
export function getStoredTrackingParams(): Record<string, string> {
	return readEnvelope()?.params ?? {};
}

/**
 * Given an internal `to` string, appends stored tracking params to it.
 * Skips non-string `to` values (objects / functions) and external hrefs.
 */
export function appendTrackingParams(to: string): string {
	const stored = getStoredTrackingParams();
	if (Object.keys(stored).length === 0) return to;

	const [path, existingSearch] = to.split("?");
	const params = new URLSearchParams(existingSearch || "");

	Object.entries(stored).forEach(([k, v]) => {
		if (!params.has(k)) params.set(k, v); // don't overwrite explicit params
	});

	return `${path}?${params.toString()}`;
}

/**
 * Saves the pricing-calculator selection (serialized "apiId:volume,…" string)
 * so lead capture can include API interest after the user leaves /pricing.
 * Pass an empty string to clear.
 * @param sel - Serialized selection, e.g. "pan-lite:50000,upi-vpa:10000".
 */
export function saveCalculatorContext(sel: string): void {
	if (sel) {
		safeSessionStorage.setItem(CALC_STORAGE_KEY, sel);
	} else {
		safeSessionStorage.removeItem(CALC_STORAGE_KEY);
	}
}

/** Returns the saved calculator selection, or an empty string. */
export function getCalculatorContext(): string {
	return safeSessionStorage.getItem(CALC_STORAGE_KEY) || "";
}

/**
 * Builds the URL sent to the Zoho CRM "Website" field on leads
 * (max 450 chars). Priority within the budget:
 * origin + path → tracking params → calculator selection.
 * Degrades gracefully: full `sel` (with volumes) → API ids only (`apis=`) →
 * no calculator context. Tracking params are never dropped (hard slice as
 * the very last resort).
 * @param maxLen - CRM field limit (default 450).
 */
export function buildLeadWebsiteUrl(maxLen = CRM_URL_MAX_LEN): string {
	const base = window.location.origin + window.location.pathname;
	const tracking = new URLSearchParams();
	Object.entries(getStoredTrackingParams()).forEach(([k, v]) =>
		tracking.set(k, v),
	);
	// Include tracking params present in the URL but not yet stored
	new URLSearchParams(window.location.search).forEach((value, key) => {
		if (value && isTrackingParam(key) && !tracking.has(key)) {
			tracking.set(key, value);
		}
	});

	const withParams = (extra?: { key: string; value: string }): string => {
		const params = new URLSearchParams(tracking);
		if (extra) params.set(extra.key, extra.value);
		const query = params.toString();
		return query ? `${base}?${query}` : base;
	};

	const sel = getCalculatorContext();
	const candidates = sel
		? [
				withParams({ key: "sel", value: sel }),
				// ids only, volumes stripped — shorter
				withParams({
					key: "apis",
					value: sel
						.split(",")
						.map((pair) => pair.split(":")[0])
						.join(","),
				}),
				withParams(),
			]
		: [withParams()];

	const fitting = candidates.find((url) => url.length <= maxLen);
	return fitting ?? candidates[candidates.length - 1].slice(0, maxLen);
}
