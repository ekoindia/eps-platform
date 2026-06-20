/**
 * Self-contained dark prism-react-renderer theme for the marketing-site
 * {@link ../components/CodeBlock} terminal. Unlike {@link ./docs/prism-rp-theme}
 * (whose colours are `--rp-*` vars scoped to `.docs-rightpane`), this theme uses
 * fixed hex so it renders correctly anywhere on the always-dark glass terminal.
 *
 * Palette mirrors the docs *dark* code panel for brand consistency:
 * teal keywords, warm-amber strings, purple functions, muted-slate comments.
 */
import type { PrismTheme } from "prism-react-renderer";

export const codeBlockTheme: PrismTheme = {
	plain: {
		color: "#e2e8f0",
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
			style: { color: "#56b6c2" },
		},
		{
			types: ["string", "char", "attr-value", "regex", "inserted"],
			style: { color: "#e5c07b" },
		},
		{
			types: ["function", "class-name", "tag", "selector"],
			style: { color: "#c678dd" },
		},
		{
			types: ["number", "url"],
			style: { color: "#d19a66" },
		},
		{
			types: ["comment", "punctuation", "prolog", "cdata", "doctype"],
			style: { color: "#7c8da3" },
		},
		{
			types: ["property", "attr-name", "variable", "parameter", "deleted"],
			style: { color: "#abb2bf" },
		},
	],
};
