import { describe, it, expect, vi } from "vitest";
import {
	createSecurityLogger,
	noopSecurityLogger,
	type SecurityRecord,
} from "./securityLog";

function capture() {
	const records: SecurityRecord[] = [];
	const logger = createSecurityLogger({
		sink: (line) => records.push(JSON.parse(line) as SecurityRecord),
		now: () => new Date("2026-06-30T12:00:00.000Z"),
	});
	return { logger, records };
}

describe("securityLog", () => {
	it("loginGranted emits a granted admin_login record", () => {
		const { logger, records } = capture();
		logger.loginGranted({ actor: "@octocat", ip: "1.2.3.4", sid: "abc" });
		expect(records).toHaveLength(1);
		expect(records[0]).toEqual({
			type: "security_audit",
			ts: "2026-06-30T12:00:00.000Z",
			event: "admin_login",
			outcome: "granted",
			action: null,
			actor: "@octocat",
			reason: null,
			ip: "1.2.3.4",
			sid: "abc",
		});
	});

	it("emits fields in the mandated order", () => {
		// Capture the RAW line so key ORDER is asserted, not just key presence.
		let raw = "";
		const logger = createSecurityLogger({
			sink: (line) => {
				raw = line;
			},
			now: () => new Date("2026-06-30T12:00:00.000Z"),
		});
		logger.mutationDenied({
			action: "propose",
			actor: "@octocat",
			ip: "1.2.3.4",
			reason: "RATE_LIMITED",
		});
		expect(Object.keys(JSON.parse(raw))).toEqual([
			"type",
			"ts",
			"event",
			"outcome",
			"action",
			"actor",
			"reason",
			"ip",
			"sid",
		]);
	});

	it("loginDenied emits a denied admin_login record with reason and null sid", () => {
		const { logger, records } = capture();
		logger.loginDenied({
			actor: "@stranger",
			ip: "5.6.7.8",
			reason: "no-write",
		});
		expect(records[0]).toMatchObject({
			event: "admin_login",
			outcome: "denied",
			action: null,
			actor: "@stranger",
			reason: "no-write",
			sid: null,
		});
	});

	it("mutationDenied emits a denied admin_mutation record with action", () => {
		const { logger, records } = capture();
		logger.mutationDenied({
			action: "deploy",
			actor: "@octocat",
			ip: "9.9.9.9",
			reason: "WRITE_ACCESS_REVOKED",
		});
		expect(records[0]).toMatchObject({
			event: "admin_mutation",
			outcome: "denied",
			action: "deploy",
			actor: "@octocat",
			reason: "WRITE_ACCESS_REVOKED",
			sid: null,
		});
	});

	it("never throws when the sink throws", () => {
		const logger = createSecurityLogger({
			sink: () => {
				throw new Error("sink exploded");
			},
		});
		expect(() =>
			logger.loginGranted({ actor: "@x", ip: "1.1.1.1", sid: "s" }),
		).not.toThrow();
	});

	it("defaults the sink to console.log", () => {
		const spy = vi.spyOn(console, "log").mockImplementation(() => {});
		try {
			createSecurityLogger().loginDenied({
				actor: "@x",
				ip: "1.1.1.1",
				reason: "OAUTH_FAILED",
			});
			expect(spy).toHaveBeenCalledTimes(1);
			const line = spy.mock.calls[0][0] as string;
			expect(JSON.parse(line).type).toBe("security_audit");
		} finally {
			spy.mockRestore();
		}
	});

	it("noopSecurityLogger does nothing and does not throw", () => {
		expect(() =>
			noopSecurityLogger.mutationDenied({
				action: "propose",
				actor: "@x",
				ip: "1.1.1.1",
				reason: "RATE_LIMITED",
			}),
		).not.toThrow();
	});
});
