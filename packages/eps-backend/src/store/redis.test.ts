import { describe, it, expect, afterAll } from "vitest";
import { runKvContract } from "./kv-contract";
import { createRedisKV } from "./redis";

const url = process.env.REDIS_TEST_URL;

// Track every client opened so we can close them — otherwise Vitest hangs on
// open sockets when REDIS_TEST_URL is set.
const opened: Array<{ close: () => Promise<void> }> = [];
afterAll(async () => {
	await Promise.all(opened.map((h) => h.close().catch(() => {})));
});

// Opt-in: only runs when REDIS_TEST_URL points at a real Redis (CI service, ≥ 6.2).
describe.skipIf(!url)("createRedisKV (contract)", () => {
	// Unique key prefix per run so repeated runs against the same Redis don't
	// collide. `advance` is omitted → the contract uses real-time waits.
	const prefix = `ct:${process.pid}:`;
	runKvContract(
		async () => {
			const handle = await createRedisKV(url!);
			opened.push(handle);
			return handle.kv;
		},
		undefined,
		prefix,
	);
});

// Spec: commands must REJECT (fail-closed), not silently queue, when the
// connection is down (`disableOfflineQueue: true`).
describe.skipIf(!url)("createRedisKV fails closed when disconnected", () => {
	it("rejects get/incr after the client is closed", async () => {
		const handle = await createRedisKV(url!);
		await handle.close(); // simulate outage
		await expect(handle.kv.get("x")).rejects.toThrow();
		await expect(handle.kv.incr("x", 1)).rejects.toThrow();
		// ping must report not-ready rather than throw.
		expect(await handle.ping()).toBe(false);
	});
});
