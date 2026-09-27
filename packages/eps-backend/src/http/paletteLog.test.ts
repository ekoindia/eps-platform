import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { openPaletteStore } from "../analytics/paletteStore";
import { createInMemoryKV } from "../store/kv";
import { AppError } from "./errors";
import { mountPaletteLog, PALETTE_IP_LIMIT } from "./paletteLog";
import type { AppEnv } from "./requestId";

function harness() {
	const app = new Hono<AppEnv>();
	// Mirrors app.ts: AppError → envelope with its own status.
	app.onError((err, c) => {
		if (err instanceof AppError) {
			return c.json({ error: { code: err.code } }, err.status as 400);
		}
		return c.json({ error: { code: "UNHANDLED" } }, 500);
	});
	const store = openPaletteStore(":memory:");
	mountPaletteLog(app, {
		kv: createInMemoryKV(),
		store,
		now: () => new Date("2026-09-27T00:00:00Z"),
	});
	const rows = () => store.rows({}, { limit: 100 });
	const post = (body: string, ip = "1.2.3.4") =>
		app.request("/telemetry/palette", {
			method: "POST",
			headers: { "content-type": "text/plain", "x-real-ip": ip },
			body,
		});
	return { post, rows };
}

const valid = {
	query: "verify pan abcde1234f",
	scope: "all",
	resultCount: 3,
	outcome: "click",
	clickedCategory: "endpoint",
	clickedRank: 1,
};

describe("POST /telemetry/palette", () => {
	it("stores one redacted row with no ip or session and answers 204", async () => {
		const { post, rows } = harness();

		const res = await post(JSON.stringify(valid));

		expect(res.status).toBe(204);
		expect(rows()).toEqual([
			{
				id: 1,
				ts: "2026-09-27T00:00:00.000Z",
				query: "verify pan …",
				scope: "all",
				resultCount: 3,
				outcome: "click",
				clickedCategory: "endpoint",
				clickedRank: 1,
			},
		]);
	});

	// A stale client may skip its own redaction; the server's is the guarantee.
	it("redacts even when the client did not", async () => {
		const { post, rows } = harness();

		await post(
			JSON.stringify({
				...valid,
				query: "aadhaar 1234 5678 9012",
				outcome: "abandon",
			}),
		);

		expect(rows()[0].query).toBe("aadhaar …");
	});

	it.each([
		["non-JSON body", "not json"],
		["empty query", JSON.stringify({ ...valid, query: "  " })],
		["overlong query", JSON.stringify({ ...valid, query: "x".repeat(201) })],
		["unknown outcome", JSON.stringify({ ...valid, outcome: "maybe" })],
		["non-slug scope", JSON.stringify({ ...valid, scope: "<script>" })],
		["negative count", JSON.stringify({ ...valid, resultCount: -1 })],
	])("rejects %s with 400 and stores nothing", async (_label, body) => {
		const { post, rows } = harness();

		expect((await post(body)).status).toBe(400);
		expect(rows()).toEqual([]);
	});

	it("rejects an oversized body with 413", async () => {
		const { post } = harness();

		expect((await post("x".repeat(3000))).status).toBe(413);
	});

	it("rate-limits per ip", async () => {
		const { post } = harness();
		const body = JSON.stringify(valid);
		for (let i = 0; i < PALETTE_IP_LIMIT; i++) await post(body);

		expect((await post(body)).status).toBe(429);
		expect((await post(body, "5.6.7.8")).status).toBe(204);
	});
});
