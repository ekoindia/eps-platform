import { describe, it, expect, vi } from "vitest";
import { StoreUnavailableError, withStoreErrors } from "./storeError";
import type { KV } from "./kv";

function baseKv(over: Partial<KV> = {}): KV {
	return {
		get: vi.fn(async () => "v"),
		set: vi.fn(async () => {}),
		del: vi.fn(async () => {}),
		getdel: vi.fn(async () => "v"),
		incr: vi.fn(async () => 1),
		...over,
	};
}

describe("withStoreErrors", () => {
	it("passes through success values unchanged", async () => {
		const kv = withStoreErrors(
			baseKv({
				get: vi.fn(async () => null),
				incr: vi.fn(async () => 7),
			}),
		);
		expect(await kv.get("k")).toBeNull();
		expect(await kv.getdel("k")).toBe("v");
		expect(await kv.incr("k", 10)).toBe(7);
		await expect(kv.set("k", "v", 5)).resolves.toBeUndefined();
		await expect(kv.del("k")).resolves.toBeUndefined();
	});

	it("forwards arguments unchanged to the underlying kv", async () => {
		const set = vi.fn(async () => {});
		const kv = withStoreErrors(baseKv({ set }));
		await kv.set("key", "val", 42);
		expect(set).toHaveBeenCalledWith("key", "val", 42);
	});

	it.each(["get", "set", "del", "getdel", "incr"] as const)(
		"wraps a rejecting %s as StoreUnavailableError with cause",
		async (method) => {
			const original = new Error("redis down");
			const kv = withStoreErrors(
				baseKv({
					[method]: vi.fn(async () => {
						throw original;
					}),
				} as Partial<KV>),
			);
			const call =
				method === "set" || method === "incr"
					? (kv[method] as (k: string, v: never, t: never) => Promise<unknown>)(
							"k",
							"v" as never,
							1 as never,
						)
					: (kv[method] as (k: string) => Promise<unknown>)("k");
			await expect(call).rejects.toBeInstanceOf(StoreUnavailableError);
			await call.catch((e) =>
				expect((e as StoreUnavailableError).cause).toBe(original),
			);
		},
	);
});
