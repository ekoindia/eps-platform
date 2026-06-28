/** Directory holding narrative guide MDX files. */
export const GUIDES_DIR = "src/content/docs";
/** Directory holding per-endpoint markdown description overrides. */
export const ENDPOINTS_DIR = "src/content/docs/endpoints";

// A guide is exactly `src/content/docs/<name>.mdx`; the filename char class
// `[A-Za-z0-9._-]` excludes `/`, so nested dirs cannot match.
const GUIDE_RE = /^src\/content\/docs\/[A-Za-z0-9._-]+\.mdx$/;
// An endpoint note is exactly `src/content/docs/endpoints/<name>.md`.
const ENDPOINT_RE = /^src\/content\/docs\/endpoints\/[A-Za-z0-9._-]+\.md$/;

/**
 * True only for files the admin console is permitted to edit (guides + endpoint
 * notes). This is the security gate for repo writes — it rejects path traversal
 * and any control character (notably a trailing newline, which JS `$` would
 * otherwise allow to slip past the anchored regex).
 */
export function isEditableDocPath(path: string): boolean {
	if (path.includes("..")) return false;
	// eslint-disable-next-line no-control-regex
	if (/[\x00-\x1f]/.test(path)) return false;
	return GUIDE_RE.test(path) || ENDPOINT_RE.test(path);
}

/**
 * Classifies an editable doc path as a guide or an endpoint note. Callers must
 * first verify the path with {@link isEditableDocPath}; an unvalidated
 * non-matching path defaults to "guide".
 */
export function docTypeFromPath(path: string): "guide" | "endpoint" {
	return ENDPOINT_RE.test(path) ? "endpoint" : "guide";
}

/** Derives a display slug (filename without extension) from a doc path. */
export function slugFromPath(path: string): string {
	const file = path.split("/").pop() ?? path;
	return file.replace(/\.(mdx|md)$/, "");
}
