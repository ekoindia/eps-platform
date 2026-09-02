import { describe, expect, it } from "vitest";

import { SDK_GUIDES } from "@/lib/data/sdk-guides";
import { renderSdkGuideMarkdown, renderSdkIndexMarkdown } from "./render-sdk";

const guide = SDK_GUIDES[0];

describe("renderSdkGuideMarkdown", () => {
	it("expands every <SdkFacts> section into markdown", () => {
		const md = renderSdkGuideMarkdown(
			guide,
			[
				"# Title",
				'<SdkFacts section="install" />',
				'<SdkFacts section="quickstart" />',
				'<SdkFacts section="config" />',
				'<SdkFacts section="members" />',
				'<SdkFacts section="files" />',
				'<SdkFacts section="errors" />',
				'<SdkFacts section="environments" />',
				'<SdkFacts section="notes" />',
			].join("\n\n"),
		);
		expect(md).not.toContain("SdkFacts");
		expect(md).toContain(guide.packageName);
		expect(md).toContain(guide.config[0].name);
		expect(md).toContain(guide.errorTypes[0].name);
		expect(md).toContain("https://staging.eko.in/ekoapi/");
	});

	// The build must fail rather than leak raw JSX into a .md twin.
	it("throws on an unknown section", () => {
		expect(() =>
			renderSdkGuideMarkdown(guide, '<SdkFacts section="nope" />'),
		).toThrow(/unknown <SdkFacts section="nope">/);
	});

	it("throws on an unrecognised <SdkFacts> form", () => {
		expect(() => renderSdkGuideMarkdown(guide, "<SdkFacts />")).toThrow(
			/unrecognised <SdkFacts> form/,
		);
	});

	it("flattens callouts to blockquotes and buttons to links", () => {
		const md = renderSdkGuideMarkdown(
			guide,
			'<Callout type="warning">\nBackend only.\n</Callout>\n\n<Button asChild><a href="/docs">Browse</a></Button>',
		);
		expect(md).toContain("> Backend only.");
		expect(md).toContain("[Browse](/docs)");
		expect(md).not.toContain("<Callout");
		expect(md).not.toContain("<Button");
	});

	it("carries front-matter and the canonical notice", () => {
		const md = renderSdkGuideMarkdown(guide, "# Title");
		expect(md.startsWith("---")).toBe(true);
		expect(md).toContain(`https://eps.eko.in/docs/sdk/${guide.slug}`);
	});
});

describe("renderSdkIndexMarkdown", () => {
	it("lists every SDK with its install command and guide URL", () => {
		const md = renderSdkIndexMarkdown();
		for (const g of SDK_GUIDES) {
			expect(md, g.slug).toContain(g.title);
			expect(md, g.slug).toContain(g.packageName);
			expect(md, g.slug).toContain(`/docs/sdk/${g.slug}`);
		}
	});
});
