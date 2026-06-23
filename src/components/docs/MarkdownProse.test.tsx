// Verifies the rich-description renderer turns GFM markdown into the expected
// HTML: GitHub-alert callouts, section headings, ordered lists, GFM tables, and
// syntax-highlighted fenced code blocks (with a language label). Renders to
// static markup (the components are SSR-safe / pure for the initial render).
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownProse } from "./MarkdownProse";

const SAMPLE = [
	"Intro paragraph with `inline code`.",
	"",
	"> [!WARNING]",
	"> You need to **encrypt the Aadhaar number** first.",
	"",
	"## Aadhaar encryption",
	"",
	"1. Decode the public key.",
	"2. Encrypt the message.",
	"",
	"```java",
	'String raw = "MIGfMA0GCSqGSIb3";',
	"```",
	"",
	"| Step | Purpose |",
	"| --- | --- |",
	"| 1 | Send OTP |",
].join("\n");

describe("MarkdownProse", () => {
	const html = renderToStaticMarkup(<MarkdownProse content={SAMPLE} />);

	it("renders a styled callout from `> [!WARNING]` and strips the marker", () => {
		expect(html).toContain("Warning");
		expect(html).not.toContain("[!WARNING]");
		// Marker text removed, body preserved.
		expect(html).toContain("encrypt the Aadhaar number");
	});

	it("renders section headings (h2) and an ordered list", () => {
		expect(html).toContain("<h2");
		expect(html).toContain("Aadhaar encryption");
		expect(html).toContain("<ol");
		expect(html).toContain("Decode the public key");
	});

	it("renders a fenced code block with its language label and highlighting", () => {
		expect(html).toContain("docs-md-code");
		expect(html).toContain(">java<");
		expect(html).toContain("MIGfMA0GCSqGSIb3");
		// prism tokenised the Java source into styled spans.
		expect(html).toMatch(/<span[^>]*style="color:var\(--mdc-/);
	});

	it("renders GFM tables", () => {
		expect(html).toContain("<table");
		expect(html).toContain("Send OTP");
	});

	it("does not render an h1 (the endpoint title owns the page h1)", () => {
		expect(html).not.toContain("<h1");
	});
});
