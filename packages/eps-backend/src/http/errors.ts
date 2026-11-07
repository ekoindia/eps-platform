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

/**
 * A profile upstream DID return, but without data this request needs.
 *
 * Permanent until someone fixes the profile upstream, so the client must not
 * retry it (`PROFILE_INCOMPLETE` is in the frontend's `NEVER_RETRY`), and the
 * user should be pointed at support rather than at a Try again button.
 * `details.missing` names the field, so support can act on a screenshot alone
 * instead of reading backend logs. `source` stays `proxy`: the refusal is ours,
 * even though the gap is in upstream's data.
 * @param missing - The absent field, in upstream's spelling where there is one.
 * @param message - User-facing text; should say what is missing and that
 *   retrying won't help.
 * @param extra - Further diagnostics merged into `details`.
 * @returns A 422 `PROFILE_INCOMPLETE` error.
 */
export function profileIncomplete(
	missing: string,
	message: string,
	extra: Record<string, unknown> = {},
): AppError {
	return new AppError(422, "PROFILE_INCOMPLETE", message, {
		missing: [missing],
		...extra,
	});
}

/**
 * The error for an interaction-151 result that is not a usable profile.
 *
 * One mapping for every caller, with the same codes `POST /auth/otp/verify`
 * answers with, so a mid-signup request no longer collapses four different
 * causes into one "Couldn't load your profile right now". Only `error` (an
 * unrecognized upstream reply) is worth retrying; the others are verdicts.
 * @param kind - The non-profile `ProfileResult` kind.
 * @returns The matching AppError.
 */
export function unusableProfile(
	kind: "not_found" | "inactive" | "not_allowed" | "error",
): AppError {
	switch (kind) {
		case "not_found":
			return new AppError(
				404,
				"PROFILE_NOT_FOUND",
				"No account exists for this number yet. Please start signup again.",
			);
		case "inactive":
			return new AppError(
				403,
				"ACCOUNT_INACTIVE",
				"This account is inactive. Please contact support.",
			);
		case "not_allowed":
			return new AppError(
				403,
				"NOT_ALLOWED",
				"This account isn't an EPS business account. Please contact support.",
			);
		case "error":
			return new AppError(
				502,
				"PROFILE_UNAVAILABLE",
				"Couldn't load your profile right now. Please try again.",
			);
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
