import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildSignedHeaders, computeSecretKey } from "@/lib/docs/eko-signing";

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

describe("buildSignedHeaders", () => {
	it("produces exactly the four auth headers and never request_hash", async () => {
		const h = await buildSignedHeaders(
			{ developerKey: "dev", accessKey: "acc" },
			1700000000000,
		);
		expect(h.developer_key).toBe("dev");
		expect(h["secret-key-timestamp"]).toBe("1700000000000");
		expect(h["content-type"]).toBe("application/json");
		expect(h["secret-key"]).toBe(ref("1700000000000", "acc"));
		expect(Object.keys(h)).not.toContain("request_hash");
	});
});
