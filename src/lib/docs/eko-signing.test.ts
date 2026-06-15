import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
	buildSignedHeaders,
	computeRequestHash,
	computeSecretKey,
} from "@/lib/docs/eko-signing";

/** Independent reference implementation using Node's crypto. */
const ref = (message: string, accessKey: string): string =>
	createHmac("sha256", Buffer.from(accessKey).toString("base64"))
		.update(message)
		.digest("base64");

describe("computeSecretKey", () => {
	it("matches an independent HMAC-SHA256(timestamp, base64(access_key)) vector", async () => {
		const accessKey = "test-access-key-123";
		const ts = "1700000000000";
		expect(await computeSecretKey(accessKey, ts)).toBe(ref(ts, accessKey));
	});

	it("is deterministic for the same inputs and varies by timestamp", async () => {
		const a = await computeSecretKey("k", "1");
		const b = await computeSecretKey("k", "1");
		const c = await computeSecretKey("k", "2");
		expect(a).toBe(b);
		expect(a).not.toBe(c);
	});
});

describe("computeRequestHash", () => {
	it("returns null when not financial or no param order declared", async () => {
		expect(await computeRequestHash({ financial: false }, {}, "k")).toBeNull();
		expect(
			await computeRequestHash({ financial: true }, { a: 1 }, "k"),
		).toBeNull();
	});

	it("concatenates declared params in order and signs them", async () => {
		const body = { amount: 500, recipient_id: "98765", extra: "ignored" };
		const spec = {
			financial: true,
			requestHashParams: ["amount", "recipient_id"],
		};
		const expected = ref("50098765", "k");
		expect(await computeRequestHash(spec, body, "k")).toBe(expected);
	});
});

describe("buildSignedHeaders", () => {
	it("produces the four base headers and omits request_hash without an order", async () => {
		const h = await buildSignedHeaders(
			{ financial: false },
			{ developerKey: "dev", accessKey: "acc" },
			{},
			1700000000000,
		);
		expect(h.developer_key).toBe("dev");
		expect(h["secret-key-timestamp"]).toBe("1700000000000");
		expect(h["content-type"]).toBe("application/json");
		expect(h["secret-key"]).toBe(ref("1700000000000", "acc"));
		expect(h.request_hash).toBeUndefined();
	});

	it("includes request_hash for a financial spec with a declared order", async () => {
		const h = await buildSignedHeaders(
			{ financial: true, requestHashParams: ["amount"] },
			{ developerKey: "dev", accessKey: "acc" },
			{ amount: 500 },
			1700000000000,
		);
		expect(h.request_hash).toBe(ref("500", "acc"));
	});
});
