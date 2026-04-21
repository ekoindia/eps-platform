import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { safeSessionStorage } from "@/lib/ssr-safe";

const TRACKING_KEYS = [
  "gclid", "fbclid", "ttclid", "msclkid",          // ad platform click IDs
  "utm_source", "utm_medium", "utm_campaign",
  "utm_content", "utm_term", "utm_id",              // UTM params
];

const STORAGE_KEY = "eps_tracking_params";

/**
 * Call once at app root (inside BrowserRouter).
 * Reads any tracking/UTM params from the current URL and persists them
 * to sessionStorage so they can be re-appended on every internal navigation.
 */
export function useCaptureTrackingParams() {
  const { search } = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(search);
    const captured: Record<string, string> = {};

    TRACKING_KEYS.forEach((key) => {
      const val = params.get(key);
      if (val) captured[key] = val;
    });

    if (Object.keys(captured).length > 0) {
      // First-touch attribution: don't overwrite already-stored params
      const existing = getStoredTrackingParams();
      safeSessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...captured, ...existing }));
    }
  }, [search]);
}

/** Returns tracking params saved from the landing URL, or an empty object. */
export function getStoredTrackingParams(): Record<string, string> {
  try {
    return JSON.parse(safeSessionStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
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
    if (!params.has(k)) params.set(k, v);   // don't overwrite explicit params
  });

  return `${path}?${params.toString()}`;
}
