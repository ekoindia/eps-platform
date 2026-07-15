import { describe, expect, it } from "vitest";
import { encodePin } from "./pintwin";

describe("encodePin", () => {
	// Golden vectors lifted from Eloka's own usePinTwin test suite. Do not
	// change these expectations — they pin the wire contract with upstream.
	it("substitutes each digit through the key and appends the key id", () => {
		expect(encodePin("1234", "1974856302", 39)).toBe("9748|39");
	});

	it("round-trips an identity key unchanged", () => {
		expect(encodePin("0123", "0123456789", 55)).toBe("0123|55");
	});

	it("accepts a string key id", () => {
		expect(encodePin("1234", "1974856302", "39")).toBe("9748|39");
	});

	it("returns empty string for an empty pin", () => {
		expect(encodePin("", "1974856302", 39)).toBe("");
	});

	it("throws when the key is not exactly 10 characters", () => {
		expect(() => encodePin("1234", "123", 39)).toThrow(/10 characters/);
	});

	it("throws on a non-digit pin", () => {
		expect(() => encodePin("12a4", "1974856302", 39)).toThrow(/digits/);
	});
});
