import type { ApiSpec } from "@/lib/data/api-specs-common";
import { defaultSnippet } from "@/lib/docs/code-snippet-sets";
import {
	renderEndpointMarkdown,
	renderGuideMarkdown,
} from "@/lib/markdown/render-doc";
import { describe, expect, it } from "vitest";

// `pan` is an active product (slug "pan-verification-api") in the registry.
// The response half of this renderer is only exercised through this fixture, so
// it carries a nested `responseData` with an `imp` marker, a real success
// payload and documented `responseTypes` — drop any of those and the matching
// assertions below go silently vacuous.
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
	responseData: [
		{ name: "pan_number", type: "string", description: "The PAN.", imp: true },
		{
			name: "holder",
			type: "object",
			description: "Registered holder.",
			children: [{ name: "name", type: "string", description: "Full name." }],
		},
	],
	sampleSuccessResponse: { status: 0, response_type_id: 309, data: {} },
	errorScenarios: [
		{
			scenario: "PAN not found",
			example: { status: 1, response_type_id: 308, data: {} },
		},
	],
	responseTypes: [
		{ id: 309, meaning: "PAN found", next: "dmt-get-recipients" },
		{ id: 308, meaning: "PAN not found" },
	],
};

describe("renderEndpointMarkdown", () => {
	const md = renderEndpointMarkdown(spec);

	it("cross-links the parent product's markdown twin", () => {
		expect(md).toContain(
			"> View product & pricing details: [PAN Verification](https://eps.eko.in/products/pan-verification-api.md)",
		);
	});

	it("flattens the response tree into dotted-path rows, starring imp fields", () => {
		expect(md).toContain("| data.pan_number ⭐ | string | The PAN. |");
		expect(md).toContain("| data.holder.name | string | Full name. |");
	});

	it("tabulates the response types, linking the next step's twin", () => {
		expect(md).toContain("## Response types");
		expect(md).toContain(
			"| 309 | PAN found | [dmt-get-recipients](https://eps.eko.in/docs/dmt-get-recipients.md) |",
		);
		// No `next` ⇒ an em dash, not an empty cell or a dead link.
		expect(md).toContain("| 308 | PAN not found | — |");
	});

	it("annotates the example response with what its id means", () => {
		expect(md).toContain("`response_type_id` `309` — PAN found.");
		expect(md).toContain(
			"Next step: [dmt-get-recipients](https://eps.eko.in/docs/dmt-get-recipients.md).",
		);
	});

	it("carries the response type into the error-scenario table", () => {
		expect(md).toContain("| 200 | `308` — PAN not found | PAN not found |");
	});

	it("omits the response-types section for a spec that documents none", () => {
		const bare = renderEndpointMarkdown({ ...spec, responseTypes: undefined });
		expect(bare).not.toContain("## Response types");
		// The error table keeps its column, but the undocumented id still shows.
		expect(bare).toContain("| 200 | `308` | PAN not found |");
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

describe("renderGuideMarkdown — <RdServiceTester> substitution", () => {
	const meta = {
		slug: "aadhaar-biometric-rdservice",
		title: "Aadhaar Biometric Auth (RDService)",
	};

	it("replaces the browser-only widget with a static pointer to the HTML page", () => {
		const md = renderGuideMarkdown(meta, "Intro.\n\n<RdServiceTester />");
		expect(md).not.toContain("<RdServiceTester");
		expect(md).toContain("Interactive RDService device tester");
		expect(md).toContain("/docs/aadhaar-biometric-rdservice");
	});

	it("also handles the empty paired form", () => {
		const md = renderGuideMarkdown(meta, "<RdServiceTester></RdServiceTester>");
		expect(md).not.toContain("<RdServiceTester");
	});

	it("throws (never leaks JSX) on a form with props", () => {
		expect(() =>
			renderGuideMarkdown(meta, '<RdServiceTester mode="iris" />'),
		).toThrow(/unrecognised <RdServiceTester>/);
	});
});
