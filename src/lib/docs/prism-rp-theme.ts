/**
 * prism-react-renderer theme + language mapping for the docs right-pane code
 * panel. Every colour is a `var(--rp-*)` token (defined in
 * `components/docs/code-samples.css`), so a SINGLE theme renders correctly in
 * both the light "Parchment" and the dark palettes — the CSS variables flip
 * with the docs `.dark` toggle, no JS theme-switching needed.
 *
 * Importing this module also activates the extra grammars (bash/php) via
 * {@link ./prism-setup}.
 */
import "./prism-setup";
import type { PrismTheme } from "prism-react-renderer";
import type { SampleLang } from "./code-samples";

/** Docs language id → Prism grammar name. cURL is shell, so it maps to `bash`. */
export const prismLangFor = (lang: SampleLang): string =>
	lang === "curl" ? "bash" : lang;

/**
 * Token → `--rp-*` colour map. Token names are kept broad so common Prism types
 * (property, boolean, regex, attr-name, …) never render unstyled.
 */
export const rpPrismTheme: PrismTheme = {
	plain: {
		color: "var(--rp-txt)",
		backgroundColor: "transparent",
	},
	styles: [
		{
			types: [
				"keyword",
				"builtin",
				"operator",
				"boolean",
				"constant",
				"symbol",
			],
			style: { color: "var(--rp-kw)" },
		},
		{
			types: ["string", "char", "attr-value", "regex", "inserted"],
			style: { color: "var(--rp-str)" },
		},
		{
			types: ["function", "class-name", "tag", "selector"],
			style: { color: "var(--rp-fn)" },
		},
		{
			types: ["url"],
			style: { color: "var(--rp-url)" },
		},
		{
			types: ["number"],
			style: { color: "var(--rp-url)" },
		},
		{
			types: ["comment", "punctuation", "prolog", "cdata", "doctype"],
			style: { color: "var(--rp-cm)" },
		},
		{
			types: ["property", "attr-name", "variable", "parameter", "deleted"],
			style: { color: "var(--rp-fg)" },
		},
	],
};
