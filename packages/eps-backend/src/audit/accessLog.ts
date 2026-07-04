/**
 * One access-log line. Emitted as a single JSON object to stdout and filtered
 * downstream on the `type: "access"` marker.
 */
export interface AccessRecord {
	type: "access";
	ts: string;
	rid: string;
	method: string;
	path: string;
	status: number;
	durMs: number;
	ip: string;
}

/** Records one line per HTTP request. Best-effort and never throws. */
export interface AccessLogger {
	log(input: {
		rid: string;
		method: string;
		path: string;
		status: number;
		durMs: number;
		ip: string;
	}): void;
}

/**
 * Creates an access logger that serializes each record to one JSON line and
 * passes it to `sink` (default `console.log`). Sync and async sink failures are
 * both swallowed — logging must never break or alter a request.
 *
 * @param opts.sink destination for each JSON line; defaults to `console.log`
 * @param opts.now  clock for the `ts` field; defaults to `() => new Date()`
 */
export function createAccessLogger(
	opts: { sink?: (line: string) => void; now?: () => Date } = {},
): AccessLogger {
	const sink = opts.sink ?? ((line: string) => console.log(line));
	const now = opts.now ?? (() => new Date());
	return {
		log({ rid, method, path, status, durMs, ip }) {
			try {
				const record: AccessRecord = {
					type: "access",
					ts: now().toISOString(),
					rid,
					method,
					path,
					status,
					durMs,
					ip,
				};
				// Absorb both synchronous throws (outer try) and async rejections
				// from a sink that returns a promise.
				void Promise.resolve(sink(JSON.stringify(record))).catch(() => {});
			} catch {
				// best-effort: a logging failure must never propagate
			}
		},
	};
}

/** A logger that does nothing — the default when none is injected. */
export const noopAccessLogger: AccessLogger = {
	log() {},
};
