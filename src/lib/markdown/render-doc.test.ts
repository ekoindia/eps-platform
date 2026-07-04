import type { ApiSpec } from "@/lib/data/api-specs-common";
import { defaultSnippet } from "@/lib/docs/code-snippet-sets";
import {
	renderEndpointMarkdown,
	renderGuideMarkdown,
} from "@/lib/markdown/render-doc";
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

describe("renderGuideMarkdown — <CodeSnippets> expansion", () => {
	const meta = { slug: "how-auth-works", title: "How Auth Works" };

	it("replaces the tag with only the default-language fenced block", () => {
		const md = renderGuideMarkdown(
			meta,
			'Intro.\n\n<CodeSnippets id="sign-request" />\n\nOutro.',
		);
		const js = defaultSnippet("sign-request");
		if (!js) throw new Error("sign-request set missing");
		// No JSX leaks into the twin.
		expect(md).not.toContain("<CodeSnippets");
		// Exactly the default language's fence + body, nothing from other langs.
		expect(md).toContain("```javascript");
		expect(md).toContain(js.code.trim());
		expect(md).not.toContain("hash_hmac"); // PHP
		expect(md).not.toContain("HMACSHA256"); // C#
		expect(md).not.toContain("hashlib"); // Python
	});

	it("also handles the empty paired form", () => {
		const md = renderGuideMarkdown(
			meta,
			'<CodeSnippets id="sign-request"></CodeSnippets>',
		);
		expect(md).not.toContain("<CodeSnippets");
		expect(md).toContain("```javascript");
	});

	it("throws (never leaks JSX) on an unknown snippet id", () => {
		expect(() =>
			renderGuideMarkdown(meta, '<CodeSnippets id="does-not-exist" />'),
		).toThrow(/unknown <CodeSnippets/);
	});
});
