import { ApiError } from "@/lib/auth/client";

/**
 * Gaps before each retry: 1s, then 3s. Two retries, so three attempts and at
 * most 4s of extra waiting before the user sees a failure.
 */
export const RETRY_DELAYS_MS = [1000, 3000] as const;

/**
 * Failures that are a verdict rather than a blip. Retrying any of these only
 * makes the user wait longer for the same answer.
 *
 * `RATE_LIMITED` is here for the opposite reason to the rest: the KYC upload
 * route budgets 20 attempts per window, so hammering it is exactly the wrong
 * move once the budget is gone.
 */
const NEVER_RETRY = new Set([
	"INVALID_INPUT",
	"FILE_TOO_LARGE",
	"UNSUPPORTED_FILE_TYPE",
	"RATE_LIMITED",
	"NO_SESSION",
	"NOT_SIGNUP_SESSION",
]);

/**
 * Whether a failure is worth another attempt.
 *
 * The backend collapses every upstream step failure into one `400 STEP_FAILED`
 * (`toAppError`, eps-backend `http/signup.ts`), so the HTTP status cannot tell a
 * flaky upstream apart from a genuine rejection. What can: the error code, and
 * whether upstream named a field. `details` carries `invalid_params` /
 * `dependent_params` — upstream saying *this field is wrong*, which no amount of
 * retrying will change.
 * @param error - The thrown value from the failed attempt.
 */
function isRetryable(error: unknown): boolean {
	if (error instanceof ApiError) {
		if (NEVER_RETRY.has(error.code)) return false;
		// 401/403 are session verdicts — `request()` has already spent its one
		// refresh replay by now. 413 is a proxy refusing the body outright.
		if ([401, 403, 413].includes(error.httpStatus)) return false;
		return error.details === undefined;
	}
	// The caller unmounted or re-queried; it does not want this answer at all.
	// Tested by `name` rather than by type: an aborted fetch rejects with a
	// `DOMException`, which is not an `instanceof Error` under jsdom or Node.
	if ((error as { name?: string } | null)?.name === "AbortError") return false;
	// Anything else is a network-level failure (fetch throws TypeError), which is
	// the most retryable thing there is.
	return true;
}

/**
 * Runs an idempotent call, retrying transient failures with a spaced backoff.
 *
 * Silent by design: every call site already shows a busy state for the whole
 * operation, so a retry just means the spinner runs a little longer. The last
 * error is rethrown unchanged, leaving each caller's own message mapping intact.
 *
 * Only wrap calls that are safe to repeat. `createProfile` in `SignupWizard`
 * deliberately is not.
 * @param run - The call to attempt. Invoked afresh each time.
 * @param delays - Gap before each retry. Its length is the retry count.
 * @returns Whatever `run` resolves to on the first attempt that succeeds.
 */
export async function withRetries<T>(
	run: () => Promise<T>,
	delays: readonly number[] = RETRY_DELAYS_MS,
): Promise<T> {
	for (let attempt = 0; ; attempt++) {
		try {
			return await run();
		} catch (error) {
			if (attempt >= delays.length || !isRetryable(error)) throw error;
			await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
		}
	}
}
