import { describe, expect, it, vi } from "vitest";
import { createEkoLogger, parseEkoLogLevel } from "./ekoLog";

const FIELDS = {
	interaction_type_id: "518",
	mobile: "9990000001",
	otp: "123456",
	org_id: "1",
	developer_key: "should-never-be-here", // not actually sent as a field, but prove it
	user_code: "99029899",
};
const RESPONSE = {
	response_status_id: 0,
	message: "OK",
	data: { secret: "x" },
};

function capture() {
	const lines: string[] = [];
	return { sink: (l: string) => lines.push(l), lines };
}

describe("parseEkoLogLevel", () => {
	it("accepts off/basic/full and falls back to basic on anything else", () => {
		expect(parseEkoLogLevel("off")).toBe("off");
		expect(parseEkoLogLevel("FULL")).toBe("full");
		expect(parseEkoLogLevel("basic")).toBe("basic");
		expect(parseEkoLogLevel(undefined)).toBe("basic");
		expect(parseEkoLogLevel("garbage")).toBe("basic");
	});
});

describe("createEkoLogger", () => {
	it("off emits nothing", () => {
		const { sink, lines } = capture();
		createEkoLogger({ level: "off", sink }).log({
			fields: FIELDS,
			status: 200,
			response: RESPONSE,
			durMs: 5,
		});
		expect(lines).toHaveLength(0);
	});

	it("basic masks the mobile, drops the OTP + full body, keeps a response summary", () => {
		const { sink, lines } = capture();
		createEkoLogger({ level: "basic", sink }).log({
			fields: FIELDS,
			status: 200,
			response: RESPONSE,
			durMs: 5,
		});
		const rec = JSON.parse(lines[0]);
		expect(rec.type).toBe("eko_upstream");
		expect(rec.interaction_type_id).toBe("518");
		expect(rec.mobile).toBe("••••••0001");
		// No OTP, no raw request, no merchant creds, no nested data leak.
		expect(lines[0]).not.toContain("123456");
		expect(rec.request).toBeUndefined();
		expect(rec.response).toEqual({ response_status_id: 0, message: "OK" });
		expect(rec.response.data).toBeUndefined();
	});

	it("full logs the complete request (incl OTP) and full response", () => {
		const { sink, lines } = capture();
		createEkoLogger({ level: "full", sink }).log({
			fields: FIELDS,
			status: 200,
			response: RESPONSE,
			durMs: 5,
		});
		const rec = JSON.parse(lines[0]);
		expect(rec.request.otp).toBe("123456");
		expect(rec.response.data.secret).toBe("x");
	});

	it("records a transport error with no status", () => {
		const { sink, lines } = capture();
		createEkoLogger({ level: "basic", sink }).log({
			fields: FIELDS,
			error: "connect ECONNREFUSED",
			durMs: 1,
		});
		const rec = JSON.parse(lines[0]);
		expect(rec.http_status).toBeNull();
		expect(rec.error).toBe("connect ECONNREFUSED");
	});

	it("never throws when the sink throws", () => {
		const bad = vi.fn(() => {
			throw new Error("sink down");
		});
		expect(() =>
			createEkoLogger({ level: "full", sink: bad }).log({
				fields: FIELDS,
				status: 200,
				response: RESPONSE,
				durMs: 5,
			}),
		).not.toThrow();
	});
});
