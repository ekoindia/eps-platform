export class AppError extends Error {
	status: number;
	code: string;
	/**
	 * Upstream diagnostics (`invalid_params`, `dependent_params`, `list_items`)
	 * that qualify `message`. Forwarded verbatim — the client decides what to
	 * render; without it "Please provide the value of the field" names no field.
	 */
	details?: Record<string, unknown>;

	constructor(
		status: number,
		code: string,
		message: string,
		details?: Record<string, unknown>,
	) {
		super(message);
		this.status = status;
		this.code = code;
		this.details = details;
	}
}

export function errorBody(
	code: string,
	message: string,
	details?: Record<string, unknown>,
) {
	// `details` is omitted rather than sent as null, so a client can branch on
	// its presence alone.
	return { error: details ? { code, message, details } : { code, message } };
}
