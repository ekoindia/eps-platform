/**
 * Who wrote the message the user is reading.
 *
 * - `api`    — the upstream call is what failed, and `message` is its envelope
 *              message (falling back to our own wording only when it sent
 *              none). Ops forwards these to Eko rather than reading our logs.
 * - `proxy`  — this service produced it: a guard, a validation, or a failure it
 *              could not get a usable upstream answer for.
 *
 * The frontend adds a third value, `client`, for failures that never reached
 * the network. Ops reads this first: it answers "is this our bug or theirs?"
 * without anyone opening a log.
 */
export type ErrorSource = "api" | "proxy";

export class AppError extends Error {
	status: number;
	code: string;
	/**
	 * Upstream diagnostics (`invalid_params`, `dependent_params`, `list_items`)
	 * that qualify `message`. Forwarded verbatim — the client decides what to
	 * render; without it "Please provide the value of the field" names no field.
	 */
	details?: Record<string, unknown>;
	/** Defaults to `proxy`: an error is ours unless it says otherwise. */
	source: ErrorSource;

	constructor(
		status: number,
		code: string,
		message: string,
		details?: Record<string, unknown>,
		source: ErrorSource = "proxy",
	) {
		super(message);
		this.status = status;
		this.code = code;
		this.details = details;
		this.source = source;
	}

	/**
	 * An error whose `message` came off the upstream envelope rather than being
	 * written here.
	 *
	 * Use this wherever the message is `envelope.message` (or equivalent): it is
	 * the difference between ops chasing our code and ops forwarding the ticket
	 * to Eko. A constructor rather than a flag at the call site so the intent is
	 * greppable — `AppError.fromUpstream` finds every forwarded message.
	 */
	static fromUpstream(
		status: number,
		code: string,
		message: string,
		details?: Record<string, unknown>,
	): AppError {
		return new AppError(status, code, message, details, "api");
	}
}

export function errorBody(
	code: string,
	message: string,
	details?: Record<string, unknown>,
	source: ErrorSource = "proxy",
) {
	// `details` is omitted rather than sent as null, so a client can branch on
	// its presence alone. `source` is always present: a client that has to test
	// for it cannot use it to route a ticket.
	return {
		error: details
			? { code, message, details, source }
			: { code, message, source },
	};
}
