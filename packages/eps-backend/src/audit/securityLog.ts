/** Discriminator for the kind of security event recorded. */
export type SecurityEvent = "admin_login" | "admin_mutation";

/** Whether the recorded attempt was allowed or refused. */
export type SecurityOutcome = "granted" | "denied";

/**
 * One security-audit log line. Emitted as a single JSON object to stdout and
 * filtered downstream on the `type: "security_audit"` marker.
 */
export interface SecurityRecord {
	type: "security_audit";
	ts: string;
	event: SecurityEvent;
	outcome: SecurityOutcome;
	action: "propose" | "deploy" | null;
	actor: string;
	reason: string | null;
	ip: string;
	sid: string | null;
}

/** Records security-relevant admin events. All methods are best-effort and never throw. */
export interface SecurityLogger {
	loginGranted(input: { actor: string; ip: string; sid: string }): void;
	loginDenied(input: { actor: string; ip: string; reason: string }): void;
	mutationDenied(input: {
		action: "propose" | "deploy";
		actor: string;
		ip: string;
		reason: string;
	}): void;
}

/**
 * Creates a security logger that serializes each record to one JSON line and
 * passes it to `sink` (default `console.log`). Any error from serialization or
 * the sink is swallowed — logging must never break or alter a request.
 *
 * @param opts.sink destination for each JSON line; defaults to `console.log`
 * @param opts.now  clock for the `ts` field; defaults to `() => new Date()`
 */
export function createSecurityLogger(
	opts: { sink?: (line: string) => void; now?: () => Date } = {},
): SecurityLogger {
	const sink = opts.sink ?? ((line: string) => console.log(line));
	const now = opts.now ?? (() => new Date());

	// The builder runs INSIDE the try so a throwing clock / serialization /
	// sink can never escape — the contract is "never throws".
	function emit(build: () => SecurityRecord): void {
		try {
			sink(JSON.stringify(build()));
		} catch {
			// best-effort: a logging failure must never propagate
		}
	}

	return {
		loginGranted({ actor, ip, sid }) {
			emit(() => ({
				type: "security_audit",
				ts: now().toISOString(),
				event: "admin_login",
				outcome: "granted",
				action: null,
				actor,
				reason: null,
				ip,
				sid,
			}));
		},
		loginDenied({ actor, ip, reason }) {
			emit(() => ({
				type: "security_audit",
				ts: now().toISOString(),
				event: "admin_login",
				outcome: "denied",
				action: null,
				actor,
				reason,
				ip,
				sid: null,
			}));
		},
		mutationDenied({ action, actor, ip, reason }) {
			emit(() => ({
				type: "security_audit",
				ts: now().toISOString(),
				event: "admin_mutation",
				outcome: "denied",
				action,
				actor,
				reason,
				ip,
				sid: null,
			}));
		},
	};
}

/** A logger whose methods do nothing — the default when no logger is injected. */
export const noopSecurityLogger: SecurityLogger = {
	loginGranted() {},
	loginDenied() {},
	mutationDenied() {},
};
