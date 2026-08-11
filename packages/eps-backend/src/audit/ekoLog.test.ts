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

	it("basic keeps the field-level diagnostics but still drops data", () => {
		const { sink, lines } = capture();
		createEkoLogger({ level: "basic", sink }).log({
			fields: FIELDS,
			status: 200,
			response: {
				response_status_id: 1,
				response_type_id: -1,
				status: 97,
				message: "Please provide the value of the field",
				invalid_params: { agreement_status: "Please provide the value" },
				data: { user_code: "43060001" },
			},
			durMs: 5,
		});
		const rec = JSON.parse(lines[0]);
		// Why it failed, not just that it did — these name fields, not values.
		expect(rec.response.invalid_params).toEqual({
			agreement_status: "Please provide the value",
		});
		expect(rec.response.status).toBe(97);
		expect(rec.response.data).toBeUndefined();
		expect(lines[0]).not.toContain("43060001");
	});

	it("basic sizes an unparseable body without quoting it", () => {
		const { sink, lines } = capture();
		createEkoLogger({ level: "basic", sink }).log({
			fields: FIELDS,
			path: "https://history.example:8080/ekoicici/v1/request",
			status: 400,
			// An upstream error page echoing a request value back at us.
			response: { nonJson: "<html>400 Bad Request: otp=123456</html>" },
			error: "non-JSON response body",
			durMs: 5,
		});
		const rec = JSON.parse(lines[0]);
		// The target is what identifies a misrouted interaction, and it is config,
		// not caller data — so it logs where the body cannot.
		expect(rec.path).toBe("https://history.example:8080/ekoicici/v1/request");
		expect(rec.response).toEqual({ nonJsonBytes: 40 });
		expect(lines[0]).not.toContain("123456");
		expect(lines[0]).not.toContain("<html>");
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

describe("redaction", () => {
	it("redacts okekeys from request fields at full level", () => {
		const lines: string[] = [];
		const logger = createEkoLogger({
			level: "full",
			sink: (l) => lines.push(l),
		});
		logger.log({
			fields: {
				interaction_type_id: "5",
				first_okekey: "9748|39",
				second_okekey: "9748|41",
				booklet_serial_number: "SN123",
			},
			status: 200,
			response: { response_type_id: 9 },
			durMs: 12,
		});
		const rec = JSON.parse(lines[0]);
		expect(rec.request.first_okekey).toBe("[REDACTED]");
		expect(rec.request.second_okekey).toBe("[REDACTED]");
		// Non-sensitive fields must survive.
		expect(rec.request.booklet_serial_number).toBe("SN123");
		expect(lines[0]).not.toContain("9748");
	});

	it("redacts pintwin_key from the response body at full level", () => {
		const lines: string[] = [];
		const logger = createEkoLogger({
			level: "full",
			sink: (l) => lines.push(l),
		});
		logger.log({
			fields: { interaction_type_id: "10005" },
			status: 200,
			response: {
				response_type_id: 0,
				data: { pintwin_key: "1974856302", key_id: 39 },
			},
			durMs: 8,
		});
		const rec = JSON.parse(lines[0]);
		expect(rec.response.data.pintwin_key).toBe("[REDACTED]");
		// key_id is not secret on its own and aids debugging.
		expect(rec.response.data.key_id).toBe(39);
		expect(lines[0]).not.toContain("1974856302");
	});

	it("redacts connect-api credentials from request and response at full level", () => {
		// A connect-api login carries the OTP up and a live session back. Assert on
		// the VALUES: the keys legitimately survive as placeholders, so grepping
		// for the key names would pass even with no redaction at all.
		const lines: string[] = [];
		const logger = createEkoLogger({
			level: "full",
			sink: (l) => lines.push(l),
			type: "connect_upstream",
		});
		logger.log({
			fields: { mobile: "9990000001", id_token: "654321", org_id: 1 },
			path: "/authentication/login",
			status: 200,
			response: {
				response_status_id: 0,
				access_token: "AT-live-value",
				refresh_token: "RT-live-value",
				access_token_lite: "ATL-live-value",
				details: { name: "Dev" },
			},
			durMs: 40,
		});
		expect(lines[0]).not.toContain("654321");
		expect(lines[0]).not.toContain("AT-live-value");
		expect(lines[0]).not.toContain("RT-live-value");
		expect(lines[0]).not.toContain("ATL-live-value");
		const rec = JSON.parse(lines[0]);
		expect(rec.type).toBe("connect_upstream");
		expect(rec.path).toBe("/authentication/login");
		// Non-secret context must survive, or the log is useless for debugging.
		expect(rec.response.details.name).toBe("Dev");
		expect(rec.response.response_status_id).toBe(0);
	});

	it("redacts a credential nested below the top level", () => {
		// connect-api posts JSON, so a token need not sit at the root the way it
		// does in Eko's flat form encoding.
		const lines: string[] = [];
		createEkoLogger({ level: "full", sink: (l) => lines.push(l) }).log({
			fields: { wrapper: { refresh_token: "RT-nested" } },
			status: 200,
			durMs: 1,
		});
		expect(lines[0]).not.toContain("RT-nested");
	});

	it("basic never emits request fields, secret or not", () => {
		const lines: string[] = [];
		createEkoLogger({ level: "basic", sink: (l) => lines.push(l) }).log({
			fields: { mobile: "9990000001", id_token: "654321" },
			path: "/authentication/login",
			status: 200,
			response: { response_status_id: 1, message: "Client reference Id" },
			durMs: 3,
		});
		const rec = JSON.parse(lines[0]);
		expect(lines[0]).not.toContain("654321");
		expect(rec.request).toBeUndefined();
		expect(rec.mobile).toBe("••••••0001");
		// The summary that would have identified the production outage in one line.
		expect(rec.response).toEqual({
			response_status_id: 1,
			message: "Client reference Id",
		});
	});

	it("does not mutate the caller's objects", () => {
		const fields = { interaction_type_id: "5", first_okekey: "9748|39" };
		const response = { data: { pintwin_key: "1974856302" } };
		const logger = createEkoLogger({ level: "full", sink: () => {} });
		logger.log({ fields, status: 200, response, durMs: 1 });
		expect(fields.first_okekey).toBe("9748|39");
		expect(response.data.pintwin_key).toBe("1974856302");
	});
});
