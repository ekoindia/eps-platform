/**
 * Reduces a generated page-twin markdown document to searchable prose, for the
 * ⌘K palette's body index (`search-body.json`).
 *
 * Input is always output from the `render-*.ts` renderers, so the shapes it
 * strips are known rather than guessed: YAML frontmatter, the boilerplate
 * canonical-URL blockquote every twin carries, fenced code, and pipe tables.
 */

/** The two-line boilerplate blockquote prepended to every generated twin. */
const CANONICAL_NOTE = /^>\s*\*\*Canonical URL:\*\*.*(?:\r?\n>.*)*(?:\r?\n)?/gm;

/**
 * Strips markdown syntax down to plain words. Deliberately not a full parser —
 * the index only needs terms, so leftover punctuation is harmless.
 */
const stripSyntax = (markdown: string): string =>
	markdown
		// Images before links: ![alt](src) would otherwise leave a stray "!".
		.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/`([^`]*)`/g, "$1")
		.replace(/[*_~]/g, "")
		// Heading and blockquote markers go, but their text stays: "## Features"
		// is a real term, and dropping whole `>` lines would delete prose too.
		.replace(/^#{1,6}\s+/gm, "")
		.replace(/^>\s?/gm, "")
		.replace(/^\s*[-+*]\s+/gm, "")
		.replace(/\s+/g, " ");

/**
 * Extracts up to `cap` characters of prose from a generated markdown twin.
 *
 * The cap is a size/recall trade-off: the whole map ships as one lazily-fetched
 * JSON file, and prose past the cap is simply unsearchable. See
 * docs/command-palette-search.md for the measured sizes behind the default.
 *
 * ponytail: one blob per item, no passage splitting. At ~195 documents,
 * passages would add result de-duplication and passage→item joins for no gain.
 * Revisit if long guides start losing to short endpoints on body-only queries.
 */
export const extractBody = (markdown: string, cap = 1500): string => {
	const prose = stripSyntax(
		markdown
			// YAML frontmatter (leading delimiter only at position 0).
			.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "")
			.replace(CANONICAL_NOTE, "")
			.replace(/```[\s\S]*?```/g, "")
			// Pipe tables: require a leading AND trailing pipe so ordinary prose
			// that happens to start with "|" is left alone.
			.replace(/^\s*\|.*\|\s*$/gm, ""),
	).trim();

	return prose.length > cap ? prose.slice(0, cap) : prose;
};
