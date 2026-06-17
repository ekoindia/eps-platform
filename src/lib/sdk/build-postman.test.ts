import { describe, expect, it } from "vitest";

import { getDocumentedSpecs } from "@/lib/data/docs-registry";
import { buildAgentBundle } from "@/lib/agent/build-agent-bundle";
import {
	buildPostmanCollection,
	PRE_REQUEST_SIGNING_SCRIPT,
} from "@/lib/sdk/build-postman";

const bundle = buildAgentBundle(getDocumentedSpecs());
const collection = buildPostmanCollection(bundle);

describe("buildPostmanCollection", () => {
	it("has an item per endpoint", () => {
		const count = collection.item.reduce(
			(n, folder) => n + (folder.item?.length ?? 0),
			0,
		);
		expect(count).toBe(bundle.apis.length);
	});

	it("ships a collection-level pre-request signing script", () => {
		const script = collection.event?.find((e) => e.listen === "prerequest");
		expect(script?.script.exec.join("\n")).toContain("CryptoJS.HmacSHA256");
	});

	it("the signing script computes secret-key from collection variables", () => {
		expect(PRE_REQUEST_SIGNING_SCRIPT).toContain("access_key");
		expect(PRE_REQUEST_SIGNING_SCRIPT).toContain("secret-key");
	});
});
