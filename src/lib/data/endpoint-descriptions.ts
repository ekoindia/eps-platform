/**
 * Resolves an endpoint's description. A spec may carry an inline
 * `spec.description` (short text), an external markdown file
 * `spec.descriptionFile` (rich: callouts, headings, code blocks, under
 * `src/content/docs/endpoints/`), or BOTH:
 *
 *  - {@link resolveDescription} — RICH, for the docs HTML page. Prefers the
 *    file; falls back to the inline string.
 *  - {@link resolveShortDescription} — for every derived/text sink (the `.md`
 *    twin, OpenAPI/Scalar, the agent/MCP bundle). Prefers the short inline
 *    string; falls back to the file so a file-only spec still has content.
 *
 * The external-file option keeps long, rich descriptions out of the giant
 * `api-specs.ts` data file and out of awkward TS template strings — mirroring
 * the guide-source pattern.
 *
 * The `import.meta.glob` lives in THIS module (not the broadly-imported
 * `api-specs-common.ts`) so the raw markdown is only bundled into the chunks
 * that actually render descriptions. Eager + `?raw` ⇒ resolution is synchronous,
 * matching the SSR/render call sites. Works in the client, the Vite SSR build
 * (`vite-plugin-generate-markdown`) and vitest.
 */
import type { ApiSpec } from "./api-specs-common";

/** basename ("foo.md") → raw markdown body, for every file in the endpoints dir. */
const DESCRIPTION_FILES: Record<string, string> = Object.fromEntries(
	Object.entries(
		import.meta.glob("../../content/docs/endpoints/*.md", {
			query: "?raw",
			import: "default",
			eager: true,
		}) as Record<string, string>,
	).map(([path, body]) => [path.split("/").pop() as string, body]),
);

/**
 * Raw body of a spec's `descriptionFile`, or `undefined` if it has none.
 * Throws loudly (build/test fail) on a misconfigured spec rather than silently
 * degrading the docs: a `descriptionFile` that does not exist on disk, or one
 * that did not load as raw text.
 */
function descriptionFileBody(spec: ApiSpec): string | undefined {
	if (!spec.descriptionFile) return undefined;
	const body = DESCRIPTION_FILES[spec.descriptionFile];
	if (body === undefined) {
		throw new Error(
			`descriptionFile "${spec.descriptionFile}" for spec "${spec.id}" not found in src/content/docs/endpoints/`,
		);
	}
	if (typeof body !== "string") {
		throw new Error(
			`descriptionFile "${spec.descriptionFile}" did not load as raw text — ensure MDX excludes content/docs/endpoints (see ssg/mdx-options.ts).`,
		);
	}
	return body.trim();
}

/**
 * RICH description for the docs HTML page: the external file wins, falling back
 * to the inline `description`. Returns `undefined` when the spec has neither.
 */
export function resolveDescription(spec: ApiSpec): string | undefined {
	return descriptionFileBody(spec) ?? spec.description;
}

/**
 * SHORT description for derived/text sinks (`.md` twin, OpenAPI/Scalar, agent
 * bundle): the inline `description` wins, falling back to the external file so a
 * file-only spec still has content. Returns `undefined` when it has neither.
 */
export function resolveShortDescription(spec: ApiSpec): string | undefined {
	return spec.description ?? descriptionFileBody(spec);
}
