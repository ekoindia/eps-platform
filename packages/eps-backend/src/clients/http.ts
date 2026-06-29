/** Default upstream request timeout (ms). Node's fetch has no default timeout. */
export const DEFAULT_FETCH_TIMEOUT_MS = 10_000;

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
