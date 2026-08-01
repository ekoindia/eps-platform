import type { ApiSpec } from "@/lib/data/api-specs-common";
import { faqsByTag, GLOBAL_FAQS } from "@/lib/data/common-faqs";
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

describe("renderGuideMarkdown — <FaqList> expansion", () => {
	const meta = { slug: "faqs", title: "Integration FAQs" };

	it("inlines the tagged questions and answers, not a component reference", () => {
		const md = renderGuideMarkdown(meta, '## Auth\n\n<FaqList tags="auth" />');
		const authFaqs = faqsByTag(GLOBAL_FAQS, ["auth"]);

		expect(md).not.toContain("<FaqList");
		expect(authFaqs.length).toBeGreaterThan(0);
		for (const faq of authFaqs) {
			expect(md).toContain(`#### ${faq.q}`);
		}
	});

	it("nests questions under the guide's own headings (h4, not h3)", () => {
		const md = renderGuideMarkdown(meta, '<FaqList tags="support" />');
		expect(md).toMatch(/^#### /m);
		expect(md).not.toMatch(/^### /m);
	});

	it("expands several sections independently", () => {
		const md = renderGuideMarkdown(
			meta,
			'## A\n\n<FaqList tags="auth" />\n\n## B\n\n<FaqList tags="support" />',
		);
		for (const tag of ["auth", "support"] as const) {
			for (const faq of faqsByTag(GLOBAL_FAQS, [tag])) {
				expect(md).toContain(`#### ${faq.q}`);
			}
		}
	});

	it("throws on an unknown tag rather than rendering a short list", () => {
		expect(() =>
			renderGuideMarkdown(meta, '<FaqList tags="integration,typo" />'),
		).toThrow(/Unknown FAQ tag/);
	});

	it("throws (never leaks JSX) on a form without a tags prop", () => {
		expect(() => renderGuideMarkdown(meta, "<FaqList />")).toThrow(
			/unrecognised <FaqList>/,
		);
	});
});

describe("renderGuideMarkdown — <SecretKeyTester> substitution", () => {
	const meta = { slug: "how-auth-works", title: "How Authentication Works" };

	it("replaces the browser-only widget with a static pointer to the HTML page", () => {
		const md = renderGuideMarkdown(meta, "Intro.\n\n<SecretKeyTester />");
		expect(md).not.toContain("<SecretKeyTester");
		expect(md).toContain("Interactive secret-key playground");
		expect(md).toContain("/docs/how-auth-works");
	});

	it("also handles the empty paired form", () => {
		const md = renderGuideMarkdown(meta, "<SecretKeyTester></SecretKeyTester>");
		expect(md).not.toContain("<SecretKeyTester");
	});

	it("throws (never leaks JSX) on a form with props", () => {
		expect(() =>
			renderGuideMarkdown(meta, '<SecretKeyTester mode="verify" />'),
		).toThrow(/unrecognised <SecretKeyTester>/);
	});
});

describe("renderGuideMarkdown — <Callout> flattening", () => {
	const meta = { slug: "aadhaar-biometric-rdservice", title: "RDService" };

	it("becomes a blockquote and its button becomes a markdown link", () => {
		const md = renderGuideMarkdown(
			meta,
			[
				'<Callout type="note">',
				"Already have a scanner? Test it right here.",
				"",
				'<Button asChild size="sm" className="mt-3">',
				'<a href="#test-your-device-setup" className="not-prose">Test my biometric device</a>',
				"</Button>",
				"</Callout>",
			].join("\n"),
		);
		expect(md).not.toContain("<Callout");
		expect(md).not.toContain("<Button");
		expect(md).toContain("> Already have a scanner? Test it right here.");
		expect(md).toContain(
			"> [Test my biometric device](#test-your-device-setup)",
		);
	});

	it("throws (never leaks JSX) on an unpaired callout", () => {
		expect(() => renderGuideMarkdown(meta, '<Callout type="note" />')).toThrow(
			/unrecognised <Callout>/,
		);
	});
});
