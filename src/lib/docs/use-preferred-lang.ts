/**
 * Shared, persisted "which language does this developer prefer" state for the
 * docs. Drives the default code-sample tab on every endpoint page and the SDK /
 * quickstart showcase on `/docs`, so a choice made anywhere follows the dev
 * everywhere.
 *
 * Mirrors the docs-theme pattern in `DocsLayout.tsx`: localStorage-backed,
 * read after mount (SSR-safe — the server renders the default and the client
 * reconciles), and resilient to storage being unavailable.
 *
 * The default is `javascript` (Node.js) rather than `curl`: we prioritise a
 * real language example over the raw cURL transcript for first-time visitors.
 */
import { useEffect, useState } from "react";
import { SAMPLE_LANGS, type SampleLang } from "@/lib/docs/code-samples";

const LANG_KEY = "eko-docs-lang";
const DEFAULT_LANG: SampleLang = "javascript";

const isSampleLang = (value: unknown): value is SampleLang =>
	SAMPLE_LANGS.some((l) => l.id === value);

/**
 * Returns the persisted preferred language and a setter that writes the choice
 * back to localStorage. Defaults to {@link DEFAULT_LANG} until a saved value is
 * read on mount.
 */
export const usePreferredLang = (): [
	SampleLang,
	(lang: SampleLang) => void,
] => {
	const [lang, setLang] = useState<SampleLang>(DEFAULT_LANG);

	useEffect(() => {
		try {
			const saved = localStorage.getItem(LANG_KEY);
			if (isSampleLang(saved)) setLang(saved);
		} catch {
			/* ignore */
		}
	}, []);

	const choose = (next: SampleLang) => {
		setLang(next);
		try {
			localStorage.setItem(LANG_KEY, next);
		} catch {
			/* ignore */
		}
	};

	return [lang, choose];
};
