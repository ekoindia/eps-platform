// Copies the site-generated SDK surface into an SDK package as a shipped asset.
//
//   node scripts/bake-surface.mjs <package-dir>
//
// Run AFTER `npm run build` at the repo root (which emits
// dist/agent/sdk-surface.json). One script for every SDK language — each
// package's `data/sdk-surface.json` is a byte-identical copy, so there is
// nothing per-language to duplicate.
//
// <package-dir> is resolved against the REPO ROOT, not the cwd: sdk-js runs
// this from `prepublishOnly` with the package as cwd, and a cwd-relative path
// would resolve to packages/sdk-js/packages/sdk-js there.
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);

const packageDir = process.argv[2];
if (!packageDir) {
	console.error("usage: node scripts/bake-surface.mjs <package-dir>");
	process.exit(1);
}

const src = path.join(repoRoot, "dist", "agent", "sdk-surface.json");
const destDir = path.resolve(repoRoot, packageDir, "data");
const dest = path.join(destDir, "sdk-surface.json");

const raw = await fs.readFile(src, "utf8"); // throws if the site wasn't built
JSON.parse(raw); // validate
await fs.mkdir(destDir, { recursive: true });
await fs.writeFile(dest, raw, "utf8");
console.error(`[bake] wrote ${dest}`);
