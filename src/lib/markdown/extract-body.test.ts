import { describe, expect, it } from "vitest";

import { extractBody } from "@/lib/markdown/extract-body";

/**
 * `extractBody` feeds the ⌘K body index. Its job is to keep prose and drop
 * scaffolding — over-eager stripping silently removes searchable content, which
 * no other test would catch.
 */

/** Shaped like a real generated twin (see dist/docs/*.md). */
const TWIN = `---
title: "Bank Account Verification API Reference"
description: "Verify a bank account by transferring ₹1 (penny drop)."
canonical: "https://eps.eko.in/docs/bank-account-verification"
---


> **Canonical URL:** https://eps.eko.in/docs/bank-account-verification
> This is a machine-readable Markdown version of the page for AI agents and LLMs.

# Bank Account Verification API Reference

\`POST https://staging.eko.in/ekoapi/v3/tools/kyc/bank-account/sync\`

Performs a live **penny-drop** transaction of ₹1 and returns the [account holder name](https://example.com/x).

## Body parameters

| Field | Type | Required |
| --- | --- | --- |
| initiator_id | string | yes |

\`\`\`json
{ "secret_code": "should-not-be-indexed" }
\`\`\`

- Bulk Verification: verify many accounts at once.
`;

describe("extractBody", () => {
	const body = extractBody(TWIN);

	it("drops YAML frontmatter", () => {
		expect(body).not.toContain("canonical:");
		expect(body).not.toContain('title: "');
	});

	it("drops the boilerplate canonical-URL note", () => {
		expect(body).not.toContain("Canonical URL");
		expect(body).not.toContain("machine-readable Markdown version");
	});

	it("drops fenced code blocks", () => {
		expect(body).not.toContain("should-not-be-indexed");
	});

	it("drops pipe tables", () => {
		expect(body).not.toContain("initiator_id");
	});

	it("keeps prose, including the terms users actually search for", () => {
		expect(body).toContain("penny-drop");
		expect(body).toContain("account holder name");
		expect(body).toContain("Bulk Verification");
	});

	it("keeps heading text while dropping the markers", () => {
		expect(body).toContain("Body parameters");
		expect(body).not.toContain("##");
	});

	it("strips emphasis and link syntax but keeps the words", () => {
		expect(body).not.toContain("**");
		expect(body).not.toContain("](");
		expect(body).not.toContain("https://example.com/x");
	});

	// Regression: stripping every line beginning with ">" removed real prose,
	// not just the canonical note. Only the boilerplate block is targeted.
	it("keeps prose from non-boilerplate blockquotes", () => {
		const md = "> A quoted sentence worth indexing.\n\nOrdinary prose.";
		expect(extractBody(md)).toContain("A quoted sentence worth indexing");
	});

	// Regression: a bare leading "|" is not a table. Requiring both a leading
	// and trailing pipe keeps prose that merely starts with one.
	it("does not treat a lone leading pipe as a table row", () => {
		expect(extractBody("| this is not really a table")).toContain(
			"not really a table",
		);
	});

	it("caps output length", () => {
		expect(extractBody("word ".repeat(5000), 100)).toHaveLength(100);
	});

	it("collapses whitespace to single spaces", () => {
		expect(extractBody("a\n\n\nb\t\tc")).toBe("a b c");
	});

	it("returns an empty string for a document with no prose", () => {
		expect(extractBody("---\ntitle: x\n---\n")).toBe("");
	});
});
