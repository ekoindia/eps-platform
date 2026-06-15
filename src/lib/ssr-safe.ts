import { SITE_URL } from "@/lib/config/site";

/** True when running in a browser (not during SSR / pre-render). */
export function isBrowser(): boolean {
	return typeof window !== "undefined";
}

/**
 * Drop-in replacement for `sessionStorage` that no-ops during SSR.
 */
export const safeSessionStorage = {
	getItem(key: string): string | null {
		if (!isBrowser()) return null;
		try {
			return sessionStorage.getItem(key);
		} catch {
			return null;
		}
	},
	setItem(key: string, value: string): void {
		if (!isBrowser()) return;
		try {
			sessionStorage.setItem(key, value);
		} catch {
			/* quota exceeded or restricted context — ignore */
		}
	},
	removeItem(key: string): void {
		if (!isBrowser()) return;
		try {
			sessionStorage.removeItem(key);
		} catch {
			/* restricted context — ignore */
		}
	},
};

/**
 * Returns the current page URL when running in the browser,
 * or the site root URL during SSR / pre-render.
 */
export function safeLocationHref(): string {
	return isBrowser() ? window.location.href : SITE_URL;
}
