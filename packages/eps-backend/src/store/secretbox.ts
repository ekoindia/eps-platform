import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

/** Encrypts/decrypts short secret strings for at-rest storage in the KV. */
export interface SecretBox {
	encrypt(plain: string): string;
	decrypt(cipher: string): string;
}

const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * Builds an AES-256-GCM SecretBox from a base64-encoded 32-byte key.
 * Output format is base64 of `iv(12) | authTag(16) | ciphertext`.
 * @throws if the decoded key is not exactly 32 bytes.
 */
export function createSecretBox(keyBase64: string): SecretBox {
	const key = Buffer.from(keyBase64, "base64");
	if (key.length !== 32) {
		throw new Error(
			`KV_ENCRYPTION_KEY must decode to 32 bytes, got ${key.length}`,
		);
	}
	return {
		encrypt(plain) {
			const iv = randomBytes(IV_BYTES);
			const cipher = createCipheriv("aes-256-gcm", key, iv);
			const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
			const tag = cipher.getAuthTag();
			return Buffer.concat([iv, tag, enc]).toString("base64");
		},
		decrypt(cipher) {
			const buf = Buffer.from(cipher, "base64");
			const iv = buf.subarray(0, IV_BYTES);
			const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
			const enc = buf.subarray(IV_BYTES + TAG_BYTES);
			const decipher = createDecipheriv("aes-256-gcm", key, iv);
			decipher.setAuthTag(tag);
			return Buffer.concat([decipher.update(enc), decipher.final()]).toString(
				"utf8",
			);
		},
	};
}

/** Identity SecretBox — stores values as-is. Used in in-memory dev/test mode. */
export const passThroughSecretBox: SecretBox = {
	encrypt: (plain) => plain,
	decrypt: (cipher) => cipher,
};
