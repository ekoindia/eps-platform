// Resolver semantics for inline `description` vs external `descriptionFile`.
// Uses the real `aeps-fingpay-biometric-ekyc.md` fixture (loaded via the module's glob).
import { describe, expect, it } from "vitest";
import type { ApiSpec } from "./api-specs-common";
import {
	resolveDescription,
	resolveShortDescription,
} from "./endpoint-descriptions";

const spec = (over: Partial<ApiSpec>): ApiSpec =>
	({ id: "test", ...over }) as unknown as ApiSpec;

const FILE = "aeps-fingpay-biometric-ekyc.md";

describe("resolveDescription (rich — docs page)", () => {
	it("prefers the file over the inline description when both are set", () => {
		const out = resolveDescription(
			spec({ description: "short text", descriptionFile: FILE }),
		);
		expect(out).toContain("[!WARNING]"); // rich file content
		expect(out).not.toBe("short text");
	});

	it("falls back to the inline description when there is no file", () => {
		expect(resolveDescription(spec({ description: "short text" }))).toBe(
			"short text",
		);
	});

	it("uses the file when only a file is set", () => {
		expect(resolveDescription(spec({ descriptionFile: FILE }))).toContain(
			"```java",
		);
	});

	it("is undefined when neither is set", () => {
		expect(resolveDescription(spec({}))).toBeUndefined();
	});
});

describe("resolveShortDescription (text sinks — .md twin / OpenAPI / agent)", () => {
	it("prefers the inline description over the file when both are set", () => {
		expect(
			resolveShortDescription(
				spec({ description: "short text", descriptionFile: FILE }),
			),
		).toBe("short text");
	});

	it("falls back to the file when only a file is set", () => {
		const out = resolveShortDescription(spec({ descriptionFile: FILE }));
		expect(out).toContain("[!WARNING]");
	});

	it("is undefined when neither is set", () => {
		expect(resolveShortDescription(spec({}))).toBeUndefined();
	});
});

describe("missing file", () => {
	it("throws loudly for an unknown descriptionFile", () => {
		expect(() =>
			resolveDescription(spec({ descriptionFile: "does-not-exist.md" })),
		).toThrow(/not found/);
	});
});
