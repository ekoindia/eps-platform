import { describe, it, expect, vi } from "vitest";
import { createAccessLogger, noopAccessLogger } from "./accessLog";

const sample = {
	rid: "R1",
	method: "POST",
	path: "/admin/propose",
	status: 200,
	durMs: 412,
	ip: "10.0.0.1",
};

describe("createAccessLogger", () => {
	it("emits one JSON line with the access shape", () => {
		const sink = vi.fn();
		createAccessLogger({
			sink,
			now: () => new Date("2026-06-30T00:00:00Z"),
		}).log(sample);
		expect(sink).toHaveBeenCalledTimes(1);
		expect(JSON.parse(sink.mock.calls[0][0])).toEqual({
			type: "access",
			ts: "2026-06-30T00:00:00.000Z",
			...sample,
		});
	});

	it("never throws when the sink throws synchronously", () => {
		const logger = createAccessLogger({
			sink: () => {
				throw new Error("boom");
			},
		});
		expect(() => logger.log(sample)).not.toThrow();
	});

	it("never throws when the sink rejects asynchronously", async () => {
		const logger = createAccessLogger({
			sink: () => {
				return Promise.reject(new Error("async boom")) as unknown as void;
			},
		});
		expect(() => logger.log(sample)).not.toThrow();
		await Promise.resolve();
	});
});

describe("noopAccessLogger", () => {
	it("does nothing", () => {
		expect(() => noopAccessLogger.log(sample)).not.toThrow();
	});
});
