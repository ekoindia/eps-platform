// Copies the site-generated golden fixtures into the package as a shipped asset.
// Run AFTER `npm run build` at the repo root (which emits dist/agent/fixtures.json).
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, "../../../dist/agent/fixtures.json");
const destDir = path.resolve(here, "../data");
const dest = path.join(destDir, "fixtures.json");

const raw = await fs.readFile(src, "utf8"); // throws if the site wasn't built
JSON.parse(raw); // validate
await fs.mkdir(destDir, { recursive: true });
await fs.writeFile(dest, raw, "utf8");
console.error(`[bake] wrote ${dest}`);
