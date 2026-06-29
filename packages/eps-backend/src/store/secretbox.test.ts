import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { createSecretBox, passThroughSecretBox } from "./secretbox";

const key = randomBytes(32).toString("base64");

describe("secretbox", () => {
	it("round-trips a value", () => {
		const box = createSecretBox(key);
		expect(box.decrypt(box.encrypt("hello"))).toBe("hello");
	});

	it("produces ciphertext that is not the plaintext", () => {
		const box = createSecretBox(key);
		const c = box.encrypt("secret-token");
		expect(c).not.toContain("secret-token");
	});

	it("uses a fresh IV per encryption (ciphertexts differ)", () => {
		const box = createSecretBox(key);
		expect(box.encrypt("same")).not.toBe(box.encrypt("same"));
	});

	it("fails to decrypt with the wrong key", () => {
		const a = createSecretBox(key);
		const b = createSecretBox(randomBytes(32).toString("base64"));
		expect(() => b.decrypt(a.encrypt("x"))).toThrow();
	});

	it("fails to decrypt tampered ciphertext (GCM tag)", () => {
		const box = createSecretBox(key);
		const c = Buffer.from(box.encrypt("x"), "base64");
		c[c.length - 1] ^= 0xff;
		expect(() => box.decrypt(c.toString("base64"))).toThrow();
	});

	it("rejects a key that is not 32 bytes", () => {
		expect(() => createSecretBox(randomBytes(16).toString("base64"))).toThrow();
	});

	it("pass-through returns input unchanged", () => {
		expect(passThroughSecretBox.encrypt("x")).toBe("x");
		expect(passThroughSecretBox.decrypt("x")).toBe("x");
	});
});
