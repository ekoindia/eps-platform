/** Directory holding narrative guide MDX files. */
export const GUIDES_DIR = "src/content/docs";
/** Directory holding per-endpoint markdown description overrides. */
export const ENDPOINTS_DIR = "src/content/docs/endpoints";

// A guide is exactly `src/content/docs/<name>.mdx` (no nested dirs — `[^/]`).
const GUIDE_RE = /^src\/content\/docs\/[A-Za-z0-9._-]+\.mdx$/;
// An endpoint note is exactly `src/content/docs/endpoints/<name>.md`.
const ENDPOINT_RE = /^src\/content\/docs\/endpoints\/[A-Za-z0-9._-]+\.md$/;

/** True only for files the admin console is permitted to edit (guides + endpoint notes). */
export function isEditableDocPath(path: string): boolean {
	if (path.includes("..")) return false;
	return GUIDE_RE.test(path) || ENDPOINT_RE.test(path);
}

/** Classifies an editable doc path as a guide or an endpoint note. */
export function docTypeFromPath(path: string): "guide" | "endpoint" {
	return ENDPOINT_RE.test(path) ? "endpoint" : "guide";
}

/** Derives a display slug (filename without extension) from a doc path. */
export function slugFromPath(path: string): string {
	const file = path.split("/").pop() ?? path;
	return file.replace(/\.(mdx|md)$/, "");
}
