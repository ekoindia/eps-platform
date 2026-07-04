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
		logger.loginGranted({
			actor: "@octocat",
			ip: "1.2.3.4",
			sid: "abc",
			rid: "test-rid",
		});
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
			rid: "test-rid",
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
			rid: "test-rid",
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
			"rid",
		]);
	});

	it("loginDenied emits a denied admin_login record with reason and null sid", () => {
		const { logger, records } = capture();
		logger.loginDenied({
			actor: "@stranger",
			ip: "5.6.7.8",
			reason: "no-write",
			rid: "test-rid",
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
			rid: "test-rid",
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
			logger.loginGranted({
				actor: "@x",
				ip: "1.1.1.1",
				sid: "s",
				rid: "test-rid",
			}),
		).not.toThrow();
	});

	it("defaults the sink to console.log", () => {
		const spy = vi.spyOn(console, "log").mockImplementation(() => {});
		try {
			createSecurityLogger().loginDenied({
				actor: "@x",
				ip: "1.1.1.1",
				reason: "OAUTH_FAILED",
				rid: "test-rid",
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
				rid: "test-rid",
			}),
		).not.toThrow();
	});

	it("includes rid on every record", () => {
		const lines: string[] = [];
		const log = createSecurityLogger({
			sink: (l) => lines.push(l),
			now: () => new Date("2026-06-30T00:00:00Z"),
		});
		log.loginGranted({ actor: "@a", ip: "1.1.1.1", sid: "S", rid: "R1" });
		log.loginDenied({
			actor: "@a",
			ip: "1.1.1.1",
			reason: "no-write",
			rid: "R2",
		});
		log.mutationDenied({
			action: "propose",
			actor: "@a",
			ip: "1.1.1.1",
			reason: "RATE_LIMITED",
			rid: "R3",
		});
		const rids = lines.map((l) => JSON.parse(l).rid);
		expect(rids).toEqual(["R1", "R2", "R3"]);
	});

	it("never throws when the sink rejects asynchronously", async () => {
		const log = createSecurityLogger({
			sink: () => Promise.reject(new Error("async")) as unknown as void,
		});
		expect(() =>
			log.loginGranted({ actor: "@a", ip: "1.1.1.1", sid: "S", rid: "R" }),
		).not.toThrow();
		await Promise.resolve();
	});
});
