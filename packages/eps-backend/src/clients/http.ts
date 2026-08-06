import { randomInt } from "node:crypto";

/** Default upstream request timeout (ms). Node's fetch has no default timeout. */
export const DEFAULT_FETCH_TIMEOUT_MS = 10_000;

/**
 * A fresh 10-character `client_ref_id` for one upstream call.
 *
 * Ten characters because connect-api rejects anything longer on
 * `/authentication/*` ("Client reference Id length should be in between 1 and
 * 10") while the interaction endpoints cap at 20 — so 10 is the only width
 * legal on every endpoint, and a single generator can serve them all.
 *
 * Millisecond stamp (base36, sortable, greppable against a log line) plus a
 * random tail, so two calls in the same millisecond stay distinct. Generated
 * server-side and never taken from the browser, so one caller cannot replay or
 * collide with another's reference.
 *
 * ponytail: 1296 distinct tails per millisecond — ample at this service's
 * request rate; widen the tail (or switch to fully random) if it ever runs hot
 * enough for a same-millisecond collision to matter.
 * @returns Exactly 10 characters of `[0-9a-z]`.
 */
export function clientRefId(): string {
	const tail = randomInt(0, 36 ** 2)
		.toString(36)
		.padStart(2, "0");
	return `${Date.now().toString(36)}${tail}`.slice(-10);
}

/**
 * Wraps a fetch implementation so every request aborts after `ms` unless the
 * caller already supplied its own `signal`. Node's `fetch` never times out by
 * default, so a hung upstream (unresponsive host, packet loss) would otherwise
 * pin a socket indefinitely and exhaust resources under load.
 *
 * @param fetchImpl - the underlying fetch (real or a test mock)
 * @param ms - abort timeout in milliseconds
 * @returns a fetch with the same signature that enforces the timeout
 */
export function withTimeout(
	fetchImpl: typeof fetch,
	ms: number = DEFAULT_FETCH_TIMEOUT_MS,
): typeof fetch {
	return (input, init) =>
		fetchImpl(input, {
			...init,
			signal: init?.signal ?? AbortSignal.timeout(ms),
		});
}
