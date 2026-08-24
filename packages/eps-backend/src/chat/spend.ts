/**
 * Monthly cost guard for the docs-chat route.
 *
 * **This is a best-effort cost guard, not a hard ceiling — by decision.** The
 * hard gate on abuse is the per-login rate limit in `http/rateLimit.ts`; this
 * exists to stop a slow leak from running all month unnoticed. A true ceiling
 * would need a conditional increment (Redis Lua) plus reserve/refund around
 * every provider call, which is a lot of moving parts to bound spend on a
 * login-gated feature that is already rate limited.
 *
 * The consequences of that choice, stated rather than discovered later:
 *  - Concurrent requests can overshoot by up to `concurrency × per-request cost`,
 *    because the check and the accounting are separate steps.
 *  - A KV outage fails **open** (answers keep flowing, accounting pauses). The
 *    alternative — refusing to answer because a counter is unavailable — trades
 *    a real outage for a hypothetical overspend.
 *
 * Cost is tracked in **micro-USD integers**. Prices are quoted per million
 * tokens, so one token costs exactly `pricePerMTok` micro-USD — the conversion
 * is a multiply, and nothing ever stores a float that could drift across a
 * Redis round trip.
 */
import type { KV } from "../store/kv";

/** ~40 days: long enough to outlive the month it keys, short enough to self-evict. */
const KEY_TTL_SEC = 40 * 24 * 60 * 60;

export interface SpendPricing {
	/** USD per million input tokens, e.g. 1 for Claude Haiku 4.5. */
	inputPerMTok: number;
	/** USD per million output tokens, e.g. 5 for Claude Haiku 4.5. */
	outputPerMTok: number;
}

export interface SpendConfig extends SpendPricing {
	/** Monthly ceiling in USD. */
	monthlyBudgetUsd: number;
}

export interface TokenUsage {
	inputTokens: number;
	outputTokens: number;
}

export interface SpendTracker {
	/** True when this month's tracked cost has passed the budget. Fails open. */
	isExhausted(): Promise<boolean>;
	/** Adds one request's weighted cost to the month. Fails open. */
	record(usage: TokenUsage): Promise<void>;
}

/** `chatspend:2026-08` — UTC, so the window does not shift with server locale. */
export function monthKey(now: Date = new Date()): string {
	const month = String(now.getUTCMonth() + 1).padStart(2, "0");
	return `chatspend:${now.getUTCFullYear()}-${month}`;
}

/**
 * Weighted cost of one request, in micro-USD.
 *
 * Output tokens cost several times input on every current model, so counting
 * raw tokens would misprice a chat workload badly — a long answer and a long
 * question are not the same money.
 */
export function costMicroUsd(usage: TokenUsage, pricing: SpendPricing): number {
	const raw =
		usage.inputTokens * pricing.inputPerMTok +
		usage.outputTokens * pricing.outputPerMTok;
	return Math.max(0, Math.round(raw));
}

/**
 * Creates the month-scoped spend tracker.
 *
 * @param kv - the shared store; every call here swallows its errors.
 * @param cfg - budget and per-MTok prices. Prices must be configured explicitly;
 *   they cannot be inferred from an arbitrary model id or base URL.
 * @param now - clock seam for tests.
 */
export function createSpendTracker(
	kv: KV,
	cfg: SpendConfig,
	now: () => Date = () => new Date(),
): SpendTracker {
	const budgetMicro = Math.round(cfg.monthlyBudgetUsd * 1_000_000);

	return {
		async isExhausted() {
			if (budgetMicro <= 0) return false; // unset budget = no guard
			try {
				const raw = await kv.get(monthKey(now()));
				const spent = Number(raw ?? 0);
				return Number.isFinite(spent) && spent >= budgetMicro;
			} catch {
				// Fail open: a store outage must not take the feature down.
				return false;
			}
		},

		async record(usage) {
			const micro = costMicroUsd(usage, cfg);
			if (micro <= 0) return;
			try {
				await kv.incrBy(monthKey(now()), micro, KEY_TTL_SEC);
			} catch {
				// Best-effort accounting; never fails a request that already succeeded.
			}
		},
	};
}
