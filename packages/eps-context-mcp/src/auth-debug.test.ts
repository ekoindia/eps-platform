import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import type { AuthCheck } from "./auth-debug.js";
import {
	DRIFT_WARN_MS,
	RANKED_403_CAUSES,
	checkSignatureShape,
	checkTimestamp,
} from "./auth-debug.js";

const NOW = 1_700_000_000_000;
const byName = (checks: AuthCheck[], name: string): AuthCheck | undefined =>
	checks.find((c) => c.name === name);

describe("checkTimestamp", () => {
	it("accepts a 13-digit millisecond value at the current time", () => {
		const checks = checkTimestamp(String(NOW), NOW);
		expect(byName(checks, "timestamp_unit")?.ok).toBe(true);
		expect(byName(checks, "clock_drift")?.ok).toBe(true);
	});

	it("names epoch seconds as the fault for a 10-digit value", () => {
		const checks = checkTimestamp("1700000000", NOW);
		expect(byName(checks, "timestamp_unit")?.ok).toBe(false);
		expect(byName(checks, "timestamp_unit")?.detail).toMatch(/SECONDS/);
		// The unit is wrong, so drift is meaningless — do not also report it.
		expect(byName(checks, "clock_drift")).toBeUndefined();
	});

	it("rejects a non-digit string rather than coercing it", () => {
		expect(
			byName(checkTimestamp("1700000000000.0", NOW), "timestamp_format")?.ok,
		).toBe(false);
		expect(byName(checkTimestamp(" 17e11 ", NOW), "timestamp_format")?.ok).toBe(
			false,
		);
	});

	it("flags an unexpected digit count without doing arithmetic on it", () => {
		// 20 digits would overflow Number's safe range if parsed.
		const checks = checkTimestamp("1".repeat(20), NOW);
		expect(byName(checks, "timestamp_unit")?.ok).toBe(false);
		expect(byName(checks, "clock_drift")).toBeUndefined();
	});

	it("flags drift in BOTH directions", () => {
		const stale = checkTimestamp(String(NOW - DRIFT_WARN_MS - 1000), NOW);
		expect(byName(stale, "clock_drift")?.ok).toBe(false);
		expect(byName(stale, "clock_drift")?.detail).toMatch(/in the past/);

		const future = checkTimestamp(String(NOW + DRIFT_WARN_MS + 1000), NOW);
		expect(byName(future, "clock_drift")?.ok).toBe(false);
		expect(byName(future, "clock_drift")?.detail).toMatch(/in the future/);
	});

	it("reports 'nothing supplied' for undefined and for an empty string alike", () => {
		for (const value of [undefined, "", "   "]) {
			expect(byName(checkTimestamp(value, NOW), "timestamp")?.ok).toBeNull();
		}
	});
});

describe("checkSignatureShape", () => {
	const valid = createHash("sha256").update("x").digest("base64");

	it("accepts canonical base64 of a 32-byte digest", () => {
		expect(valid).toHaveLength(44);
		expect(checkSignatureShape(valid)[0].ok).toBe(true);
	});

	it("catches a raw hex digest (base64 step skipped)", () => {
		const hex = createHash("sha256").update("x").digest("hex");
		expect(checkSignatureShape(hex)[0].detail).toMatch(/64 hex/);
	});

	it("catches URL-safe base64", () => {
		const urlSafe = createHash("sha256")
			.update("x")
			.digest("base64url")
			.padEnd(44, "=");
		expect(checkSignatureShape(urlSafe)[0].ok).toBe(false);
	});

	it("catches a 44-char base64 string that decodes to the wrong byte length", () => {
		// 33 bytes also encodes to 44 characters — length alone proves nothing.
		const wrongBytes = Buffer.alloc(33, 7).toString("base64");
		expect(wrongBytes).toHaveLength(44);
		const check = checkSignatureShape(wrongBytes)[0];
		expect(check.ok).toBe(false);
		expect(check.detail).toMatch(/33 bytes/);
	});

	it("catches a shorter digest from the wrong hash", () => {
		const sha1 = createHash("sha1").update("x").digest("base64");
		expect(checkSignatureShape(sha1)[0].detail).toMatch(/20 bytes/);
	});

	it("catches surrounding whitespace and a trailing newline", () => {
		expect(checkSignatureShape(`${valid}\n`)[0].detail).toMatch(/whitespace/i);
		expect(checkSignatureShape(`  ${valid}`)[0].detail).toMatch(/whitespace/i);
	});

	it("reports 'nothing supplied' for undefined and for an empty string alike", () => {
		for (const value of [undefined, "", "   "]) {
			expect(checkSignatureShape(value)[0].ok).toBeNull();
		}
	});
});

describe("both inputs together", () => {
	it("reports an independent verdict per field", () => {
		const valid = createHash("sha256").update("x").digest("base64");
		const checks = [
			...checkTimestamp("1700000000", NOW),
			...checkSignatureShape(valid),
		];
		expect(byName(checks, "timestamp_unit")?.ok).toBe(false);
		expect(byName(checks, "signature_shape")?.ok).toBe(true);
	});
});

describe("RANKED_403_CAUSES", () => {
	it("has stable unique ids", () => {
		const ids = RANKED_403_CAUSES.map((c) => c.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("ranks provisioning above signing math", () => {
		const ids = RANKED_403_CAUSES.map((c) => c.id);
		expect(ids[0]).toBe("ip_not_allowlisted");
		// The algorithm is confirmed; a signing bug is the least likely cause.
		expect(ids.at(-1)).toBe("key_decoded_before_signing");
	});
});
