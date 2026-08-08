/**
 * Field-level normalisation shared by both profile mappers — the direct
 * interaction-151 path (`clients/eko.ts`) and the connect-api path
 * (`clients/connect.ts`).
 *
 * Lives here rather than in either client so neither provider imports the
 * other: both produce the same `EkoProfile`, so the rules that shape its fields
 * belong to neither of them.
 */

/**
 * Keys whose VALUES must never leave this service.
 *
 * `userDetail` is forwarded to the browser wholesale (see `EkoProfile`), so this
 * is the boundary that keeps a credential out of `sessionStorage`. It is a
 * denylist and therefore inherently incomplete — a credential upstream adds
 * under a name none of these patterns match WILL reach the browser. Widen it the
 * moment interaction 151 grows a field of that kind.
 *
 * Two near-misses are deliberate rather than accidental:
 * - `pincode` / `pin_code` are postal codes and stay. `^[mtu]?pin$` is anchored
 *   so it matches only the PIN itself (`pin`, `mpin`, `tpin`, `upin`).
 * - `is_pin_not_set` stays: it is a boolean "has this user chosen a PIN yet",
 *   which connect-api forwards to its own frontend too, not the PIN.
 */
const SENSITIVE_KEY =
	/token|secret|password|passwd|otp|_key$|^key$|^[mtu]?pin$/i;

/**
 * Copies an upstream detail object, dropping every key that looks like a
 * credential.
 *
 * Recursive by design. A one-level filter would pass a nested
 * `{ device: { access_token } }` straight through, and upstream owns this shape
 * — nothing here can promise it stays flat. Arrays are walked too, since a list
 * of contacts or devices is exactly where such an object would sit.
 * @param value - The object to copy; any non-object is returned unchanged.
 * @returns A deep copy with sensitive keys removed at every level.
 */
export function stripSensitive(
	value: Record<string, unknown>,
): Record<string, unknown> {
	return scrub(value) as Record<string, unknown>;
}

function scrub(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(scrub);
	if (!value || typeof value !== "object") return value;
	const out: Record<string, unknown> = {};
	for (const [key, inner] of Object.entries(value)) {
		if (SENSITIVE_KEY.test(key)) continue;
		out[key] = scrub(inner);
	}
	return out;
}

/**
 * Reads `user_detail.account_state_id`, the id the lifecycle state machine
 * branches on (`deriveStateFromProfile`).
 *
 * Rejects anything that is not a whole number rather than coercing it, because
 * `Number("")` and `Number(" ")` are both `0` — a blank field would otherwise
 * arrive as a real-looking state id and be compared against the KYC one.
 * @param raw - The upstream value, in whatever type it crossed JSON as.
 * @returns The id, or null when absent or not an integer.
 */
export function toStateId(raw: unknown): number | null {
	if (typeof raw === "number") return Number.isInteger(raw) ? raw : null;
	if (typeof raw !== "string" || !raw.trim()) return null;
	const parsed = Number(raw);
	return Number.isInteger(parsed) ? parsed : null;
}
