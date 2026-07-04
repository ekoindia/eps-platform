import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { sanitizeRequestId, requestId, type AppEnv } from "./requestId";

describe("sanitizeRequestId", () => {
	it("strips disallowed characters", () => {
		expect(sanitizeRequestId("ab c/<>$id")).toBe("abcid");
	});
	it("caps length at 128", () => {
		expect(sanitizeRequestId("a".repeat(200))).toHaveLength(128);
	});
	it("returns empty string for undefined", () => {
		expect(sanitizeRequestId(undefined)).toBe("");
	});
	it("returns empty string when nothing survives sanitization", () => {
		expect(sanitizeRequestId("/// ")).toBe("");
	});
	it("passes a valid id through unchanged", () => {
		expect(sanitizeRequestId("req_A1.b-2")).toBe("req_A1.b-2");
	});
});

describe("requestId middleware", () => {
	function app(opts?: { genId?: () => string }) {
		const a = new Hono<AppEnv>();
		a.use("*", requestId(opts));
		a.get("/x", (c) => c.text(c.get("rid")));
		return a;
	}

	it("mints an id when no inbound header is present", async () => {
		const res = await app({ genId: () => "GEN" }).request("/x");
		expect(await res.text()).toBe("GEN");
		expect(res.headers.get("x-request-id")).toBe("GEN");
	});

	it("reuses a sanitized inbound x-request-id", async () => {
		const res = await app().request("/x", {
			headers: { "x-request-id": "inbound id!" },
		});
		expect(await res.text()).toBe("inboundid");
		expect(res.headers.get("x-request-id")).toBe("inboundid");
	});

	it("never throws when genId throws (fallback id)", async () => {
		const res = await app({
			genId: () => {
				throw new Error("boom");
			},
		}).request("/x");
		expect(res.status).toBe(200);
		expect((await res.text()).length).toBeGreaterThan(0);
	});
});
