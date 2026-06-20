import type { ApiSpec } from "@/lib/data/api-specs-common";
import { renderEndpointMarkdown } from "@/lib/markdown/render-doc";
import { describe, expect, it } from "vitest";

// `pan` is an active product (slug "pan-verification-api") in the registry.
const spec: ApiSpec = {
	id: "pan-lite",
	productId: "pan",
	name: "PAN Lite",
	slug: "pan-lite",
	summary: "Quick PAN validation.",
	method: "POST",
	path: "/pan/lite",
	docsUrl: "",
	extraRequestParams: [],
	responseData: [],
	sampleSuccessResponse: {},
};

describe("renderEndpointMarkdown", () => {
	const md = renderEndpointMarkdown(spec);

	it("cross-links the parent product's markdown twin", () => {
		expect(md).toContain(
			"> View product & pricing details: [PAN Verification](https://eps.eko.in/products/pan-verification-api.md)",
		);
	});
});
