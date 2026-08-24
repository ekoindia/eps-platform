import {
	ApiError,
	recentCalls,
	type CallRecord,
	type ErrorSource,
	type UpstreamCall,
} from "@/lib/auth/client";
import { readCachedSession } from "@/lib/auth/session-cache";

/**
 * Everything worth knowing about one failure, gathered in one place.
 *
 * The point is a screenshot. A user sends a picture of an error and the team
 * has to identify the request, the account and the upstream call from it alone,
 * without server access — so whatever is not on screen may as well not exist.
 */
export interface Diagnostics {
	/** The raw message, for the copy blob and the ticket. May be unfit to render. */
	message: string;
	/**
	 * The message safe to show a user, or undefined when there is none.
	 *
	 * Only the API layer produces wording meant for humans. A raw `Error` from a
	 * render or a library says something like "Cannot read properties of
	 * undefined", and `PARSE_ERROR` carries the first 200 characters of an HTML
	 * error page — neither belongs on screen, though both belong in the blob.
	 */
	safeMessage?: string;
	code: string;
	source: ErrorSource;
	httpStatus?: number;
	/** Backend correlation id — the grep key for the server logs. */
	requestId?: string;
	/** The account, as the user knows it. */
	ekoCode?: string;
	/** Server clock at the failure. */
	serverTime?: string;
	/** Backend build that served it. */
	version?: string;
	/** Underlying reason behind an opaque 502, when the backend disclosed one. */
	cause?: string;
	/** Field-level upstream diagnostics (`invalid_params` and friends). */
	details?: Record<string, unknown>;
	/** Upstream calls the backend made for this request. */
	trace?: UpstreamCall[];
	/** What the browser was doing just before — see `recentCalls`. */
	recent: CallRecord[];
	/** Browser clock, to catch a skew that would otherwise confuse log matching. */
	clientTime: string;
	/** Page the failure happened on. */
	url?: string;
	/** React component stack, when an error boundary caught the failure. */
	componentStack?: string | null;
}

/** The signed-in user's ekocode, from the cached session. Never throws. */
function cachedEkoCode(): string | undefined {
	try {
		const me = readCachedSession();
		if (!me || !("profile" in me)) return undefined;
		const code = me.profile?.code;
		return code == null || code === "" ? undefined : String(code);
	} catch {
		// A corrupt or absent cache must not stop an error from rendering.
		return undefined;
	}
}

/**
 * Collects everything known about a failure.
 *
 * Takes `unknown` because catch blocks do: a non-`ApiError` (a thrown string, a
 * React render failure) still deserves a code and a copyable blob rather than
 * being silently downgraded to bare text.
 */
export function errorDiagnostics(err: unknown): Diagnostics {
	const api = err instanceof ApiError ? err : null;
	const message =
		api?.message ??
		(err instanceof Error ? err.message : String(err ?? "Unknown error"));
	return {
		message,
		safeMessage:
			api && api.code !== "PARSE_ERROR" && message ? message : undefined,
		code: api?.code ?? "UNEXPECTED_ERROR",
		// Anything that is not an ApiError never made it to the network layer, so
		// whatever went wrong happened in the browser.
		source: api?.source ?? "client",
		httpStatus: api?.httpStatus,
		requestId: api?.requestId,
		ekoCode: cachedEkoCode(),
		serverTime: api?.serverTime,
		version: api?.version,
		cause: api?.cause,
		details: api?.details,
		trace: api?.trace,
		recent: recentCalls(),
		clientTime: new Date().toISOString(),
		url: typeof window === "undefined" ? undefined : window.location.href,
	};
}

/**
 * The one-line identifier strip rendered under an error message.
 *
 * Ordered by what someone reads first: who is responsible, what broke, which
 * upstream reference to quote to Eko, whose account, which request to grep.
 * Empty fields are dropped rather than shown blank — `ref —` teaches nobody
 * anything and costs a line of a screenshot.
 *
 * @example "api · KYC_LIST_FAILED · ref m9k2xq4b0f · EkoCode 12345 · rid 3f2a1b7c"
 */
export function diagnosticsLine(d: Diagnostics): string {
	const upstreamRef = d.trace?.find((c) => c.clientRefId)?.clientRefId;
	return [
		d.source,
		d.code,
		upstreamRef && `ref ${upstreamRef}`,
		d.ekoCode && `EkoCode ${d.ekoCode}`,
		d.requestId && `rid ${d.requestId}`,
	]
		.filter(Boolean)
		.join(" · ");
}

/**
 * The full diagnostic as pretty JSON, for the clipboard and for a support
 * ticket.
 *
 * JSON rather than prose because it is pasted into a ticket and read by whoever
 * picks it up — structure survives copy-paste, formatting does not.
 */
export function diagnosticsBlob(d: Diagnostics): string {
	try {
		return JSON.stringify(d, null, 2);
	} catch {
		// A circular value somewhere in `details`/`trace` must not cost the user
		// the identifiers, which are the part that actually gets acted on.
		return JSON.stringify(
			{
				message: d.message,
				code: d.code,
				source: d.source,
				requestId: d.requestId,
				ekoCode: d.ekoCode,
				clientTime: d.clientTime,
				note: "full diagnostics were not serializable",
			},
			null,
			2,
		);
	}
}
