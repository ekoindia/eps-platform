import { describe, expect, it, vi } from "vitest";
import { createInMemoryKV } from "../store/kv";
import type { KV } from "../store/kv";
import { costMicroUsd, createSpendTracker, monthKey } from "./spend";

const PRICING = { inputPerMTok: 1, outputPerMTok: 5 }; // Claude Haiku 4.5

const deadKv = (): KV => ({
	get: async () => {
		throw new Error("kv down");
	},
	set: async () => {
		throw new Error("kv down");
	},
	del: async () => {
		throw new Error("kv down");
	},
	getdel: async () => {
		throw new Error("kv down");
	},
	incr: async () => {
		throw new Error("kv down");
	},
	incrBy: async () => {
		throw new Error("kv down");
	},
});

describe("costMicroUsd", () => {
	it("weights output tokens by their own price, not the input price", () => {
		// 1000 in @ $1/MTok = 1000 micro-USD; 1000 out @ $5/MTok = 5000.
		expect(costMicroUsd({ inputTokens: 1000, outputTokens: 0 }, PRICING)).toBe(1000);
		expect(costMicroUsd({ inputTokens: 0, outputTokens: 1000 }, PRICING)).toBe(5000);
		expect(costMicroUsd({ inputTokens: 1000, outputTokens: 1000 }, PRICING)).toBe(6000);
	});

	it("stays an integer under fractional prices, so nothing drifts in the store", () => {
		const c = costMicroUsd(
			{ inputTokens: 333, outputTokens: 777 },
			{ inputPerMTok: 0.25, outputPerMTok: 1.25 },
		);
		expect(Number.isInteger(c)).toBe(true);
	});

	it("never goes negative on a garbage usage report", () => {
		expect(costMicroUsd({ inputTokens: -5, outputTokens: 0 }, PRICING)).toBe(0);
	});
});

describe("monthKey", () => {
	it("keys by UTC month, so the window does not move with server locale", () => {
		expect(monthKey(new Date("2026-08-23T23:30:00Z"))).toBe("chatspend:2026-08");
		expect(monthKey(new Date("2026-01-01T00:00:00Z"))).toBe("chatspend:2026-01");
	});
});

describe("createSpendTracker", () => {
	it("accumulates weighted cost and reports exhaustion once past budget", async () => {
		const kv = createInMemoryKV();
		// $0.01 budget = 10_000 micro-USD.
		const t = createSpendTracker(kv, { ...PRICING, monthlyBudgetUsd: 0.01 });

		expect(await t.isExhausted()).toBe(false);
		await t.record({ inputTokens: 1000, outputTokens: 1000 }); // 6_000
		expect(await t.isExhausted()).toBe(false);
		await t.record({ inputTokens: 1000, outputTokens: 1000 }); // 12_000 total
		expect(await t.isExhausted()).toBe(true);
	});

	it("is inert when no budget is configured", async () => {
		const kv = createInMemoryKV();
		const t = createSpendTracker(kv, { ...PRICING, monthlyBudgetUsd: 0 });
		await t.record({ inputTokens: 10_000_000, outputTokens: 10_000_000 });
		expect(await t.isExhausted()).toBe(false);
	});

	it("rolls over at the month boundary", async () => {
		const kv = createInMemoryKV();
		let clock = new Date("2026-08-31T23:59:00Z");
		const t = createSpendTracker(kv, { ...PRICING, monthlyBudgetUsd: 0.001 }, () => clock);

		await t.record({ inputTokens: 0, outputTokens: 1000 }); // 5_000 > 1_000
		expect(await t.isExhausted()).toBe(true);

		clock = new Date("2026-09-01T00:01:00Z");
		expect(await t.isExhausted()).toBe(false);
	});

	it("fails OPEN on a store outage — both reading and recording", async () => {
		const t = createSpendTracker(deadKv(), { ...PRICING, monthlyBudgetUsd: 0.01 });
		expect(await t.isExhausted()).toBe(false);
		await expect(t.record({ inputTokens: 1, outputTokens: 1 })).resolves.toBeUndefined();
	});

	it("treats a corrupted counter as not-exhausted rather than locking the feature", async () => {
		const kv = createInMemoryKV();
		await kv.set(monthKey(), "not-a-number", 60);
		const t = createSpendTracker(kv, { ...PRICING, monthlyBudgetUsd: 0.01 });
		expect(await t.isExhausted()).toBe(false);
	});
});
