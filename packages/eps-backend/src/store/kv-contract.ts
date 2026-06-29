import { it, expect } from "vitest";
import type { KV } from "./kv";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Behavioral contract every KV backend must satisfy. Call inside a `describe`.
 * - `makeKv` returns a fresh KV.
 * - `advance` (optional) fast-forwards the in-memory injectable clock; when
 *   omitted (Redis), the contract uses real `setTimeout` waits instead.
 * - `keyPrefix` namespaces every key so a shared Redis instance does not collide
 *   across runs/suites. In-memory passes "".
 */
export function runKvContract(
	makeKv: () => KV | Promise<KV>,
	advance?: (ms: number) => void,
	keyPrefix = "",
): void {
	const k = (s: string) => `${keyPrefix}${s}`;
	const step = async (ms: number) => {
		if (advance) advance(ms);
		else await wait(ms);
	};

	it("round-trips set/get", async () => {
		const kv = await makeKv();
		await kv.set(k("a"), "1", 60);
		expect(await kv.get(k("a"))).toBe("1");
	});

	it("set replaces the value", async () => {
		const kv = await makeKv();
		await kv.set(k("a"), "1", 60);
		await kv.set(k("a"), "2", 60);
		expect(await kv.get(k("a"))).toBe("2");
	});

	it("get returns null after the TTL elapses", async () => {
		const kv = await makeKv();
		await kv.set(k("e"), "v", 1);
		await step(1100);
		expect(await kv.get(k("e"))).toBeNull();
	});

	it("set on an existing key RESETS the TTL", async () => {
		const kv = await makeKv();
		await kv.set(k("r"), "1", 1); // expires at +1000ms
		await step(500); // +500ms
		await kv.set(k("r"), "2", 2); // reset: now expires at +2500ms
		await step(600); // +1100ms total — past the ORIGINAL 1s expiry
		// Still present ⇒ the second set reset the TTL (a KEEPTTL bug would miss).
		expect(await kv.get(k("r"))).toBe("2");
		// ...and it still expires on the NEW TTL (catches a SET that drops EX).
		await step(1600); // +2700ms total — past the reset 2s window (which began at +500ms)
		expect(await kv.get(k("r"))).toBeNull();
	});

	it("getdel returns once then misses", async () => {
		const kv = await makeKv();
		await kv.set(k("g"), "v", 60);
		expect(await kv.getdel(k("g"))).toBe("v");
		expect(await kv.getdel(k("g"))).toBeNull();
	});

	it("incr is a FIXED window: TTL set on first hit only, never extended", async () => {
		const kv = await makeKv();
		expect(await kv.incr(k("c"), 2)).toBe(1); // window opens, TTL 2s
		await step(1100); // advance BETWEEN increments (this is what distinguishes
		expect(await kv.incr(k("c"), 2)).toBe(2); // fixed from sliding)
		await step(1100); // +2200ms total — past the 2s window
		// Fixed-window ⇒ counter reset to 1. A sliding impl would return 3 here.
		expect(await kv.incr(k("c"), 2)).toBe(1);
	});
}
