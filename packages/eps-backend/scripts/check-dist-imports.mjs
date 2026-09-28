/**
 * Fails when the built bundle imports a module Node cannot resolve at runtime.
 *
 * Vitest runs the TypeScript source, so a bundler rewrite that breaks an
 * import (tsup stripping `node:` from the prefix-only `node:sqlite`, which
 * crash-looped prod on 2026-09-28) passes every test. Reads the esbuild
 * metafile, so run via `npm run check:dist`, which emits it.
 */
import { readFileSync } from "node:fs";

const meta = JSON.parse(readFileSync("dist/metafile-esm.json", "utf8"));
const externals = new Set(
	meta.outputs["dist/index.js"].imports
		.filter((entry) => entry.external)
		.map((entry) => entry.path),
);
const unresolvable = [...externals].filter((specifier) => {
	try {
		import.meta.resolve(specifier);
		return false;
	} catch {
		return true;
	}
});
if (unresolvable.length) {
	console.error(
		`dist/index.js imports unresolvable modules: ${unresolvable.join(", ")}`,
	);
	process.exit(1);
}
console.log(`ok: ${externals.size} external imports resolve`);
