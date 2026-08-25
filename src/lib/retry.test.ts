import { ApiError } from "@/lib/auth/client";
import { RETRY_DELAYS_MS, withRetries } from "@/lib/retry";
import { describe, expect, it, vi } from "vitest";

/** No real waiting: every test drives the schedule itself. */
const NOW = [0, 0] as const;

/** A run that rejects with `error` the first `times` times, then resolves. */
function failing(times: number, error: unknown) {
	let calls = 0;
	const run = vi.fn(async () => {
		calls += 1;
		if (calls <= times) throw error;
		return "ok";
	});
	return run;
}

describe("withRetries", () => {
	it("returns the first attempt's value without retrying", async () => {
		const run = vi.fn(async () => "ok");
		await expect(withRetries(run, NOW)).resolves.toBe("ok");
		expect(run).toHaveBeenCalledTimes(1);
	});

	it("recovers when a transient failure succeeds on a later attempt", async () => {
		const run = failing(2, new ApiError("STEP_FAILED", "upstream blip", 400));
		await expect(withRetries(run, NOW)).resolves.toBe("ok");
		expect(run).toHaveBeenCalledTimes(3);
	});

	it("gives up after the last delay and rethrows the final error", async () => {
		const last = new ApiError("STEP_FAILED", "still down", 400);
		const run = failing(99, last);
		await expect(withRetries(run, NOW)).rejects.toBe(last);
		expect(run).toHaveBeenCalledTimes(3);
	});

	it("retries a network failure, which fetch throws as a TypeError", async () => {
		const run = failing(1, new TypeError("Failed to fetch"));
		await expect(withRetries(run, NOW)).resolves.toBe("ok");
		expect(run).toHaveBeenCalledTimes(2);
	});

	// The whole point of the deny-list: a verdict must reach the user at once.
	it.each([
		["FILE_TOO_LARGE", 400],
		["UNSUPPORTED_FILE_TYPE", 400],
		["INVALID_INPUT", 400],
		["RATE_LIMITED", 429],
		["NO_SESSION", 401],
		["NOT_SIGNUP_SESSION", 403],
	])("never retries %s", async (code, status) => {
		const error = new ApiError(code, "no", status);
		const run = failing(99, error);
		await expect(withRetries(run, NOW)).rejects.toBe(error);
		expect(run).toHaveBeenCalledTimes(1);
	});

	it("never retries a STEP_FAILED that names a bad field", async () => {
		const error = new ApiError("STEP_FAILED", "Fix your PAN", 400, {
			invalid_params: { pancardnumber: "is not valid" },
		});
		const run = failing(99, error);
		await expect(withRetries(run, NOW)).rejects.toBe(error);
		expect(run).toHaveBeenCalledTimes(1);
	});

	// A body the infrastructure refused outright. Retrying re-uploads it in full
	// for the same answer — and 413 arrives as an unreadable proxy page, so the
	// status is the only thing left to decide on.
	it("never retries a 413, whatever the code says", async () => {
		const error = new ApiError("PARSE_ERROR", "<html>413", 413);
		const run = failing(99, error);
		await expect(withRetries(run, NOW)).rejects.toBe(error);
		expect(run).toHaveBeenCalledTimes(1);
	});

	it("never retries an aborted request", async () => {
		const error = new DOMException("aborted", "AbortError");
		const run = failing(99, error);
		await expect(withRetries(run, NOW)).rejects.toBe(error);
		expect(run).toHaveBeenCalledTimes(1);
	});

	it("waits 1s before the first retry and 3s before the second", async () => {
		vi.useFakeTimers();
		try {
			const run = failing(2, new ApiError("STEP_FAILED", "blip", 400));
			const settled = withRetries(run);

			await vi.advanceTimersByTimeAsync(999);
			expect(run).toHaveBeenCalledTimes(1);
			await vi.advanceTimersByTimeAsync(1);
			expect(run).toHaveBeenCalledTimes(2);

			await vi.advanceTimersByTimeAsync(2999);
			expect(run).toHaveBeenCalledTimes(2);
			await vi.advanceTimersByTimeAsync(1);
			expect(run).toHaveBeenCalledTimes(3);

			await expect(settled).resolves.toBe("ok");
		} finally {
			vi.useRealTimers();
		}
	});

	it("exposes the schedule the call sites rely on", () => {
		expect(RETRY_DELAYS_MS).toEqual([1000, 3000]);
	});
});
