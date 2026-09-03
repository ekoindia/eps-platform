import { describe, expect, it } from "vitest";

import {
	API_PARAM_FORMATS,
	assertFormatRegistry,
	formatPatterns,
} from "./api-formats";

/** Conformance fixtures mirrored in docs/sdk-golden-vector.md. Every SDK
 * suite pins the same rows, so the wire behaviour is identical everywhere. */
const CASES: Record<string, { ok: string[]; bad: string[] }> = {
	date: { ok: ["2026-01-01"], bad: ["2026-1-1", "01-01-2026", "2026-01-01\n"] },
	"lat-long": {
		ok: ["28.6139,77.2090", "28,77", "-12.5,77"],
		bad: ["28.6139", "28.6139, 77.2090"],
	},
	mobile: { ok: ["9876543210"], bad: ["1234567890", "98765", "+919876543210"] },
	pan: { ok: ["ABCDE1234F"], bad: ["abcde1234f", "ABCDE12345"] },
	aadhaar: { ok: ["123456789012"], bad: ["1234 5678 9012", "12345678901"] },
	ifsc: { ok: ["SBIN0007515"], bad: ["SBIN1007515", "sbin0007515"] },
	pincode: { ok: ["110001"], bad: ["1100011", "11000"] },
	"client-ref": {
		ok: ["a", "ORD-2024_9871", "x".repeat(20)],
		bad: ["", "x".repeat(21), "a b"],
	},
};

describe("API_PARAM_FORMATS", () => {
	it("passes its own portability guard", () => {
		expect(() => assertFormatRegistry()).not.toThrow();
	});

	it("has a fixture row for every format", () => {
		expect(Object.keys(CASES).sort()).toEqual(
			Object.keys(API_PARAM_FORMATS).sort(),
		);
	});

	for (const [name, { ok, bad }] of Object.entries(CASES)) {
		it(`${name}: whole-string match`, () => {
			const re = new RegExp(API_PARAM_FORMATS[name].pattern);
			for (const v of ok) expect(re.test(v), v).toBe(true);
			for (const v of bad) expect(re.test(v), v).toBe(false);
		});
	}

	it("formatPatterns() is the name → pattern map the surface bakes", () => {
		expect(formatPatterns().date).toBe(API_PARAM_FORMATS.date.pattern);
	});
});

describe("assertFormatRegistry", () => {
	it.each([
		["unanchored", "\\d+"],
		["lookahead", "^(?=a)a$"],
		["backreference", "^(a)\\1$"],
		["named group", "^(?<x>a)$"],
		["possessive", "^a++$"],
		["non-ASCII", "^é$"],
		["does not compile", "^[$"],
	])("rejects %s", (_label, pattern) => {
		expect(() =>
			assertFormatRegistry({ bad: { pattern, label: "x" } }),
		).toThrow(/api-formats: "bad"/);
	});
});
