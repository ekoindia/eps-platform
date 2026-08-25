import { beforeEach, describe, expect, it } from "vitest";
import { ApiError, clearCallLog } from "@/lib/auth/client";
import {
	writeCachedSession,
	clearCachedSession,
} from "@/lib/auth/session-cache";
import type { MeView } from "@/lib/auth/client";
import {
	diagnosticsBlob,
	diagnosticsLine,
	errorDiagnostics,
} from "./diagnostics";

/** A cached session carrying just the field the diagnostics reads. */
function cacheEkoCode(code: string | number) {
	writeCachedSession({
		state: "active",
		mobile: "9990000001",
		zohoId: null,
		profile: { code } as unknown as MeView["profile"],
	} as MeView);
}

describe("errorDiagnostics", () => {
	beforeEach(() => {
		clearCachedSession();
		clearCallLog();
	});

	it("carries the backend's source and identifiers through", () => {
		const err = new ApiError(
			"KYC_LIST_FAILED",
			"Upstream said no",
			502,
			undefined,
			{
				source: "api",
				requestId: "rid-1",
				version: "abc123",
				serverTime: "2026-08-25T00:00:00.000Z",
				trace: [
					{
						path: "/transactions/do",
						clientRefId: "m9k2xq4b0f",
						status: 200,
						durMs: 12,
						error: null,
					},
				],
			},
		);
		const d = errorDiagnostics(err);
		expect(d.source).toBe("api");
		expect(d.requestId).toBe("rid-1");
		expect(d.version).toBe("abc123");
		expect(d.trace?.[0].clientRefId).toBe("m9k2xq4b0f");
	});

	it("treats a non-ApiError as client-side and withholds its message", () => {
		// A render crash says "Cannot read properties of undefined". It belongs in
		// the blob, never on screen — that is what `safeMessage` decides.
		const d = errorDiagnostics(new TypeError("Cannot read properties of x"));
		expect(d.source).toBe("client");
		expect(d.code).toBe("UNEXPECTED_ERROR");
		expect(d.message).toBe("Cannot read properties of x");
		expect(d.safeMessage).toBeUndefined();
	});

	it("withholds a PARSE_ERROR message, which is raw HTML", () => {
		const d = errorDiagnostics(
			new ApiError("PARSE_ERROR", "<!doctype html><html>", 200),
		);
		expect(d.safeMessage).toBeUndefined();
		// Still recoverable for whoever picks up the ticket.
		expect(d.message).toContain("doctype");
	});

	it("reads the ekocode from the cached session", () => {
		cacheEkoCode(12345);
		expect(errorDiagnostics(new Error("x")).ekoCode).toBe("12345");
	});

	it("survives having no cached session at all", () => {
		expect(errorDiagnostics(new Error("x")).ekoCode).toBeUndefined();
	});
});

describe("diagnosticsLine", () => {
	beforeEach(() => {
		clearCachedSession();
		clearCallLog();
	});

	it("names source, code, upstream ref, account and request id", () => {
		cacheEkoCode(12345);
		const line = diagnosticsLine(
			errorDiagnostics(
				new ApiError("KYC_LIST_FAILED", "nope", 502, undefined, {
					source: "api",
					requestId: "rid-1",
					trace: [
						{
							path: "/p",
							clientRefId: "m9k2xq4b0f",
							status: 200,
							durMs: 1,
							error: null,
						},
					],
				}),
			),
		);
		expect(line).toBe(
			"api · KYC_LIST_FAILED · ref m9k2xq4b0f · EkoCode 12345 · rid rid-1",
		);
	});

	it("drops fields it does not have rather than showing them blank", () => {
		// An anonymous caller has no ekocode and a network failure has no rid;
		// printing "EkoCode —" would waste the line a screenshot has to carry.
		const line = diagnosticsLine(
			errorDiagnostics(
				new ApiError("NETWORK_ERROR", "offline", 0, undefined, {
					source: "client",
				}),
			),
		);
		expect(line).toBe("client · NETWORK_ERROR");
	});

	// The failure that sent us here: an oversized KYC upload came back as an
	// unreadable proxy page. The message is withheld and the code says only
	// "unreadable", so without the status the line named nothing actionable.
	it("carries the HTTP status for a PARSE_ERROR, which has nothing else", () => {
		cacheEkoCode(48060001);
		const line = diagnosticsLine(
			errorDiagnostics(
				new ApiError("PARSE_ERROR", "An error occurred", 502, undefined, {
					source: "proxy",
				}),
			),
		);
		expect(line).toBe("proxy · PARSE_ERROR · HTTP 502 · EkoCode 48060001");
	});

	it("leaves the status off every other code, which names its own cause", () => {
		const line = diagnosticsLine(
			errorDiagnostics(
				new ApiError("KYC_UPLOAD_FAILED", "nope", 502, undefined, {
					source: "api",
				}),
			),
		);
		expect(line).toBe("api · KYC_UPLOAD_FAILED");
	});
});

describe("diagnosticsBlob", () => {
	beforeEach(clearCallLog);

	it("round-trips as JSON", () => {
		const d = errorDiagnostics(new ApiError("X", "y", 400));
		expect(JSON.parse(diagnosticsBlob(d)).code).toBe("X");
	});

	it("still yields the identifiers when the payload will not serialize", () => {
		// A circular value in upstream `details` must not cost the user the part
		// that actually gets acted on.
		const circular: Record<string, unknown> = {};
		circular.self = circular;
		const d = errorDiagnostics(
			new ApiError("X", "y", 400, circular, { requestId: "rid-9" }),
		);
		const parsed = JSON.parse(diagnosticsBlob(d));
		expect(parsed.requestId).toBe("rid-9");
		expect(parsed.note).toMatch(/not serializable/i);
	});
});
