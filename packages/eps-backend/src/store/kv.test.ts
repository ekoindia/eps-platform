import { describe, it, expect } from "vitest";
import { createInMemoryKV } from "./kv";

describe("InMemoryKV", () => {
	it("set/get/del roundtrip", async () => {
		const kv = createInMemoryKV();
		await kv.set("a", "1", 60);
		expect(await kv.get("a")).toBe("1");
		await kv.del("a");
		expect(await kv.get("a")).toBeNull();
	});

	it("expires entries past ttl", async () => {
		let t = 1000;
		const kv = createInMemoryKV(() => t);
		await kv.set("a", "1", 10);
		t = 1000 + 11_000;
		expect(await kv.get("a")).toBeNull();
	});

	it("incr counts within a window then resets after ttl", async () => {
		let t = 0;
		const kv = createInMemoryKV(() => t);
		expect(await kv.incr("c", 10)).toBe(1);
		expect(await kv.incr("c", 10)).toBe(2);
		t = 11_000;
		expect(await kv.incr("c", 10)).toBe(1);
	});
});
