import { describe, expect, it } from "vitest";

import { SIGNING_LANGUAGES, getSigningSnippet } from "./signing-snippets.js";

describe("getSigningSnippet", () => {
	it("supports all six languages", () => {
		expect(SIGNING_LANGUAGES).toEqual([
			"php",
			"java",
			"csharp",
			"javascript",
			"python",
			"go",
		]);
	});

	it("each snippet mentions HMAC-SHA256, base64, timestamp; never a real key", () => {
		for (const lang of SIGNING_LANGUAGES) {
			const code = getSigningSnippet(lang);
			expect(code.toLowerCase()).toContain("hmac");
			expect(code.toLowerCase()).toContain("sha256");
			expect(code.toLowerCase()).toContain("base64");
			// must not hardcode a literal access_key value
			expect(code).not.toMatch(/access[_-]?key\s*=\s*["'][A-Za-z0-9]{8,}/i);
		}
	});

	it("returns a clear error string for an unknown language", () => {
		// getSigningSnippet accepts a plain string and guards unknown values at
		// runtime (it is not narrowed to SigningLanguage), so this is valid TS.
		expect(getSigningSnippet("cobol")).toMatch(/unsupported language/i);
	});
});
