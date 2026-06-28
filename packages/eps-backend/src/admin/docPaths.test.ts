import { describe, it, expect } from "vitest";
import { isEditableDocPath, docTypeFromPath, slugFromPath } from "./docPaths";

describe("isEditableDocPath", () => {
	it("accepts guide .mdx and endpoint .md", () => {
		expect(isEditableDocPath("src/content/docs/how-auth-works.mdx")).toBe(true);
		expect(isEditableDocPath("src/content/docs/endpoints/aeps-cw.md")).toBe(
			true,
		);
	});
	it("rejects traversal, wrong dir, wrong ext, absolute, nested", () => {
		expect(isEditableDocPath("src/content/docs/../../secrets.mdx")).toBe(false);
		expect(isEditableDocPath("src/lib/data/api-specs.ts")).toBe(false);
		expect(isEditableDocPath("src/content/docs/how-auth-works.ts")).toBe(false);
		expect(isEditableDocPath("/etc/passwd")).toBe(false);
		expect(isEditableDocPath("src/content/docs/sub/deep.mdx")).toBe(false);
		expect(isEditableDocPath("src/content/docs/endpoints/aeps-cw.mdx")).toBe(
			false,
		);
	});
	it("rejects trailing newline / control characters (JS $ anchor bypass)", () => {
		expect(isEditableDocPath("src/content/docs/how-auth-works.mdx\n")).toBe(
			false,
		);
		expect(isEditableDocPath("src/content/docs/endpoints/aeps-cw.md\r")).toBe(
			false,
		);
		expect(isEditableDocPath("src/content/docs/how-auth\x00works.mdx")).toBe(
			false,
		);
	});
});

describe("docTypeFromPath / slugFromPath", () => {
	it("classifies and slugs", () => {
		expect(docTypeFromPath("src/content/docs/endpoints/aeps-cw.md")).toBe(
			"endpoint",
		);
		expect(docTypeFromPath("src/content/docs/how-auth-works.mdx")).toBe(
			"guide",
		);
		expect(slugFromPath("src/content/docs/how-auth-works.mdx")).toBe(
			"how-auth-works",
		);
		expect(slugFromPath("src/content/docs/endpoints/aeps-cw.md")).toBe(
			"aeps-cw",
		);
	});
});
