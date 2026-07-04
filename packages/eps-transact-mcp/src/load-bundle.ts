import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { AgentBundle } from "./bundle-types.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const BAKED_PATH = path.resolve(here, "../data/eps.json");

/** Load the baked bundle, or a fresh one from EPS_BUNDLE_URL when set. */
export const loadBundle = async (): Promise<{
	bundle: AgentBundle;
	source: "baked" | "remote";
}> => {
	const url = process.env.EPS_BUNDLE_URL;
	if (url) {
		try {
			const res = await fetch(url);
			if (res.ok)
				return { bundle: (await res.json()) as AgentBundle, source: "remote" };
		} catch {
			// fall through to baked
		}
	}
	const raw = await fs.readFile(BAKED_PATH, "utf8");
	return { bundle: JSON.parse(raw) as AgentBundle, source: "baked" };
};
