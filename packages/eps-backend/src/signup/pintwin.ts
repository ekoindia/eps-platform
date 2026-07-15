/** Length of a pintwin key: one substitution target per decimal digit. */
const PINTWIN_KEY_LENGTH = 10;

/**
 * Encodes a PIN by substituting each digit through a server-issued pintwin key.
 *
 * The key is a permutation of `0-9`; digit `d` maps to `key[d]`. The key id is
 * appended so the upstream can pick the right table to invert. Keys are
 * single-use and invalidated upstream after each attempt, so every submit must
 * fetch a fresh one.
 *
 * This is obfuscation, not encryption — the key travels in plaintext and the
 * substitution is trivially reversible by anyone holding it. Its only security
 * value is that a captured okekey cannot be replayed.
 *
 * @param pin - The raw PIN; digits only.
 * @param key - The 10-character pintwin key from interaction 10005.
 * @param keyId - The key's id, appended after a `|` separator.
 * @returns The encoded okekey (e.g. `"9748|39"`), or `""` for an empty pin.
 * @throws If the key is not exactly 10 characters, or the pin holds a non-digit.
 */
export function encodePin(
	pin: string,
	key: string,
	keyId: number | string,
): string {
	if (key.length !== PINTWIN_KEY_LENGTH) {
		throw new Error(
			`pintwin key must be exactly ${PINTWIN_KEY_LENGTH} characters, got ${key.length}`,
		);
	}
	if (pin.length === 0) return "";
	if (!/^[0-9]+$/.test(pin)) {
		throw new Error("pin must contain digits only");
	}
	const encoded = pin
		.split("")
		.map((digit) => key[Number(digit)])
		.join("");
	return `${encoded}|${keyId}`;
}
