import { useSyncExternalStore } from "react";

/**
 * Whether the docs are currently in dark mode.
 *
 * `DocsLayout` scopes its `.dark` class to the docs subtree and mirrors it as
 * `docs-dark` on `<html>`; a Radix portal renders outside that subtree, so the
 * Try-it dialog reads the root flag instead and re-renders when it flips
 * (theme restore can land after a `?try=1` auto-open).
 */
const subscribe = (onChange: () => void): (() => void) => {
	if (typeof MutationObserver === "undefined") return () => {};
	const observer = new MutationObserver(onChange);
	observer.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["class"],
	});
	return () => observer.disconnect();
};

const read = (): boolean =>
	typeof document !== "undefined" &&
	document.documentElement.classList.contains("docs-dark");

export const useDocsDark = (): boolean =>
	useSyncExternalStore(subscribe, read, () => false);
