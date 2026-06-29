import { describe, it, expect } from "vitest";
import { enforceRateLimit } from "./rateLimit";
import { createInMemoryKV, type KV } from "../store/kv";
import { AppError } from "./errors";

describe("enforceRateLimit", () => {
	it("allows up to the limit, then throws 429 RATE_LIMITED", async () => {
		const kv = createInMemoryKV();
		for (let i = 0; i < 3; i++) {
			await expect(enforceRateLimit(kv, "k", 3, 600)).resolves.toBeUndefined();
		}
		await expect(enforceRateLimit(kv, "k", 3, 600)).rejects.toMatchObject({
			status: 429,
			code: "RATE_LIMITED",
		});
	});

	it("keys are independent", async () => {
		const kv = createInMemoryKV();
		await enforceRateLimit(kv, "a", 1, 600);
		await expect(enforceRateLimit(kv, "b", 1, 600)).resolves.toBeUndefined();
		await expect(enforceRateLimit(kv, "a", 1, 600)).rejects.toMatchObject({
			status: 429,
		});
	});

	it("window resets after TTL expiry (fake clock)", async () => {
		let now = 0;
		const kv = createInMemoryKV(() => now);
		await enforceRateLimit(kv, "k", 1, 1);
		await expect(enforceRateLimit(kv, "k", 1, 1)).rejects.toMatchObject({
			status: 429,
		});
		now += 2000; // advance past the 1s window
		await expect(enforceRateLimit(kv, "k", 1, 1)).resolves.toBeUndefined();
	});

	it("KV outage → 503 RATE_LIMIT_UNAVAILABLE", async () => {
		const failing: KV = {
			get: async () => null,
			set: async () => {},
			del: async () => {},
			getdel: async () => null,
			incr: async () => {
				throw new Error("redis down");
			},
		};
		await expect(enforceRateLimit(failing, "k", 5, 600)).rejects.toBeInstanceOf(
			AppError,
		);
		await expect(enforceRateLimit(failing, "k", 5, 600)).rejects.toMatchObject({
			status: 503,
			code: "RATE_LIMIT_UNAVAILABLE",
		});
	});
});
