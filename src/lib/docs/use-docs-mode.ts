/**
 * Shared, persisted "how does this developer want to integrate" mode for the
 * docs — the API / SDK / AI-Coding choice. It is presented both on the `/docs`
 * showcase (the path-chooser) and on every endpoint's code pane, so the choice
 * made in one place carries everywhere.
 *
 * Mirrors {@link usePreferredLang} / the docs-theme pattern: localStorage-backed,
 * read after mount (SSR-safe — the server renders the default and the client
 * reconciles), resilient to storage being unavailable.
 *
 * Default is `sdk`: the signed SDKs are the headline integration path.
 */
import { useEffect, useState } from "react";

export type DocsMode = "api" | "sdk" | "ai";

const MODE_KEY = "eko-docs-mode";
const DEFAULT_MODE: DocsMode = "sdk";

const isDocsMode = (value: unknown): value is DocsMode =>
	value === "api" || value === "sdk" || value === "ai";

/**
 * Returns the persisted integration mode and a setter that writes the choice
 * back to localStorage. Defaults to {@link DEFAULT_MODE} until a saved value is
 * read on mount.
 */
export const useDocsMode = (): [DocsMode, (mode: DocsMode) => void] => {
	const [mode, setMode] = useState<DocsMode>(DEFAULT_MODE);

	useEffect(() => {
		try {
			const saved = localStorage.getItem(MODE_KEY);
			if (isDocsMode(saved)) setMode(saved);
		} catch {
			/* ignore */
		}
	}, []);

	const choose = (next: DocsMode) => {
		setMode(next);
		try {
			localStorage.setItem(MODE_KEY, next);
		} catch {
			/* ignore */
		}
	};

	return [mode, choose];
};
