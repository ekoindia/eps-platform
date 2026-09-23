import { SITE_URL } from "@/lib/config/site";

/** True when running in a browser (not during SSR / pre-render). */
export function isBrowser(): boolean {
	return typeof window !== "undefined";
}

/**
 * Wraps a Web Storage area so every call no-ops during SSR and swallows
 * quota / restricted-context errors.
 * @param area - Lazily resolves the storage (must not be touched at import
 *   time, since `window` is absent during SSR).
 */
function safeStorage(area: () => Storage) {
	return {
		getItem(key: string): string | null {
			if (!isBrowser()) return null;
			try {
				return area().getItem(key);
			} catch {
				return null;
			}
		},
		setItem(key: string, value: string): void {
			if (!isBrowser()) return;
			try {
				area().setItem(key, value);
			} catch {
				/* quota exceeded or restricted context — ignore */
			}
		},
		removeItem(key: string): void {
			if (!isBrowser()) return;
			try {
				area().removeItem(key);
			} catch {
				/* restricted context — ignore */
			}
		},
	};
}

/** Drop-in replacement for `sessionStorage` that no-ops during SSR. */
export const safeSessionStorage = safeStorage(() => sessionStorage);

/** Drop-in replacement for `localStorage` that no-ops during SSR. */
export const safeLocalStorage = safeStorage(() => localStorage);

/**
 * Returns the current page URL when running in the browser,
 * or the site root URL during SSR / pre-render.
 */
export function safeLocationHref(): string {
	return isBrowser() ? window.location.href : SITE_URL;
}
