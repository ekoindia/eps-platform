import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { CODE_SNIPPET_SETS, defaultSnippet } from "./code-snippet-sets";

// Golden vector — copied from docs/sdk-golden-vector.md (the cross-language SSOT).
// `expected` is the published test signature, not a real secret; its field is
// named neutrally so the gitleaks generic-api-key rule doesn't flag the value
// (same reason sdk-js names its constant GOLDEN).
const GOLDEN = {
	accessKey: "TEST_ACCESS_KEY_DO_NOT_USE",
	timestamp: "1700000000000",
	expected: "u30ak/iOGwKCaspqCeiYng8fd98QDx7kF3DBBOadQHk=",
};

describe("sign-request snippet set", () => {
	const set = CODE_SNIPPET_SETS["sign-request"];

	it("covers the five documented languages, Node.js first", () => {
		expect(set.map((s) => s.language)).toEqual([
			"javascript",
			"python",
			"php",
			"java",
			"csharp",
		]);
		expect(defaultSnippet("sign-request")?.language).toBe("javascript");
	});

	it("the documented algorithm reproduces the golden vector", () => {
		// The convention every snippet claims to implement: HMAC key is the
		// base64 STRING of the access key (not its decoded bytes).
		const encodedKey = Buffer.from(GOLDEN.accessKey).toString("base64");
		const secretKey = crypto
			.createHmac("sha256", encodedKey)
			.update(GOLDEN.timestamp)
			.digest("base64");
		expect(secretKey).toBe(GOLDEN.expected);
	});

	it("no snippet base64-DECODES the key before HMAC (the classic 403 bug)", () => {
		// Each pattern indicates keying HMAC with the DECODED bytes — the wrong
		// convention that produces a different signature and a 403. Note the JS
		// pattern targets Buffer.from(x, "base64") specifically; the correct
		// `.toString("base64")` / `.digest("base64")` encodings are fine.
		const wrongConvention = [
			/Buffer\.from\([^)]*,\s*["']base64["']/, // JS decode
			/base64_decode/, // PHP
			/b64decode/, // Python
			/getDecoder/, // Java: Base64.getDecoder()
			/FromBase64String/, // C#: Convert.FromBase64String
		];
		for (const snippet of set) {
			for (const pattern of wrongConvention) {
				expect(snippet.code).not.toMatch(pattern);
			}
		}
	});

	it("every snippet encodes the key and mentions the timestamp", () => {
		for (const snippet of set) {
			expect(snippet.code.toLowerCase()).toMatch(/base64|encodetostring/);
			expect(snippet.code).toMatch(/timestamp|timeMillis|microtime/i);
		}
	});
});
