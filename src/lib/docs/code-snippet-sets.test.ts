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

describe("encrypt-aadhaar snippet set", () => {
	const set = CODE_SNIPPET_SETS["encrypt-aadhaar"];

	it("covers the five documented languages, Node.js first", () => {
		expect(set.map((s) => s.language)).toEqual([
			"javascript",
			"python",
			"php",
			"java",
			"csharp",
		]);
	});

	it("every snippet names PKCS#1 v1.5 padding explicitly", () => {
		for (const snippet of set) {
			expect(snippet.code).toMatch(/PKCS1/i);
		}
	});

	it("the published Node.js snippet round-trips with a throwaway key pair", async () => {
		const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
			modulusLength: 1024,
		});
		const publicKeyBase64 = publicKey
			.export({ type: "spki", format: "der" })
			.toString("base64");
		// Execute the exact copy-paste code, not a re-implementation of it.
		const moduleUrl = `data:text/javascript,${encodeURIComponent(set[0].code)}`;
		const { encryptAadhaar } = await import(/* @vite-ignore */ moduleUrl);

		const first = encryptAadhaar("123412341234", publicKeyBase64);
		const plain = crypto.privateDecrypt(
			{ key: privateKey, padding: crypto.constants.RSA_PKCS1_PADDING },
			Buffer.from(first, "base64"),
		);
		expect(plain.toString("utf8")).toBe("123412341234");
		// Randomized padding: same input, different ciphertext each call.
		expect(encryptAadhaar("123412341234", publicKeyBase64)).not.toBe(first);
		expect(() => encryptAadhaar("1234 1234 1234", publicKeyBase64)).toThrow();
	});
});

describe("aadhaar-number-encryption guide", () => {
	it("publishes a UAT key that parses as an RSA SPKI public key", async () => {
		const { default: mdx } =
			await import("../../content/docs/aadhaar-number-encryption.mdx?raw");
		const uatKey = mdx.match(/### UAT\s+```text\s+(\S+)\s+```/)?.[1];
		expect(uatKey).toBeDefined();
		const key = crypto.createPublicKey({
			key: Buffer.from(uatKey as string, "base64"),
			format: "der",
			type: "spki",
		});
		expect(key.asymmetricKeyType).toBe("rsa");
	});
});
