import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { loadBundle } from "./load-bundle.js";
import { buildToolDefs } from "./tools.js";

// Tools are generated from data/eps.json but executed through EpsClient, which
// resolves endpoints from sdk-js's baked data/sdk-surface.json. Both derive
// from the same bundle build, but the baked copies can skew if one package is
// re-baked without the other — this guards the runtime contract.
const here = path.dirname(fileURLToPath(import.meta.url));
const surface = JSON.parse(
	readFileSync(
		path.resolve(here, "../../sdk-js/data/sdk-surface.json"),
		"utf8",
	),
) as {
	bundleVersion: string;
	endpoints: {
		slug: string;
		method: string;
		path: string;
		requiredParams: string[];
	}[];
};

const { bundle } = await loadBundle();
const tools = buildToolDefs(bundle);
const surfaceBySlug = new Map(surface.endpoints.map((e) => [e.slug, e]));
const apiBySlug = new Map(bundle.apis.map((a) => [a.slug, a]));

describe("eps.json ↔ sdk-surface.json parity", () => {
	it("both baked artifacts come from the same bundle build", () => {
		expect(surface.bundleVersion).toBe(bundle.meta.bundleVersion);
	});

	it("every exposed tool resolves in the SDK surface with matching contract", () => {
		for (const tool of tools) {
			const endpoint = surfaceBySlug.get(tool.slug);
			const api = apiBySlug.get(tool.slug);
			expect(endpoint, `sdk-surface missing "${tool.slug}"`).toBeTruthy();
			expect(endpoint?.method).toBe(api?.method);
			expect(endpoint?.path).toBe(api?.path);
			expect([...(endpoint?.requiredParams ?? [])].sort()).toEqual(
				api?.requestParams
					.filter((p) => p.required)
					.map((p) => p.name)
					.sort(),
			);
		}
	});
});
