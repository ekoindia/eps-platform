import type { Context, Hono } from "hono";
import { getCookie } from "hono/cookie";
import type { Sessions } from "../auth/session";
import { ACCESS_COOKIE } from "../auth/session";
import type { EkoClient } from "../clients/eko";
import { identityOf } from "../clients/eko";
import type { Config } from "../config";
import type { TransactionRow } from "../types";
import { AppError } from "./errors";
import type { AppEnv } from "./requestId";

/** Rows per page. Mirrors the console's `PAGE_LIMIT`; also the upper bound. */
const MAX_LIMIT = 25;

/**
 * Trust-boundary rules for the filter fields, mirroring `parseBusiness` in
 * `signup.ts`. Only these keys are ever forwarded upstream — an attacker must
 * not be able to smuggle extra interaction fields (`org_id`, `user_code`,
 * `interaction_type_id`, …) through the filter object.
 *
 * `start_date`/`tx_date` are Eloka's names for From/To. Their exact upstream
 * semantics are UNVERIFIED on this transport — see
 * docs/features/transaction-history.md §Unverified.
 */
const FILTER_RULES: Record<string, RegExp> = {
	tid: /^\d{1,20}$/,
	account: /^[A-Za-z0-9]{1,25}$/,
	customer_mobile: /^\d{10}$/,
	amount: /^\d+(\.\d{1,2})?$/,
	start_date: /^\d{4}-\d{2}-\d{2}$/,
	tx_date: /^\d{4}-\d{2}-\d{2}$/,
	rr_no: /^[A-Za-z0-9]{1,30}$/,
};

/**
 * Validates and narrows an untrusted body to the known filter fields.
 *
 * Only known keys are copied out; empty values are dropped rather than sent as
 * blank filters.
 * @param body - Untrusted JSON body.
 * @returns The allow-listed filters as strings.
 * @throws {AppError} 400 INVALID_INPUT on the first field that fails its rule.
 */
export function parseFilters(body: unknown): Record<string, string> {
	const src = ((body ?? {}) as { filters?: unknown }).filters;
	const filters = (src ?? {}) as Record<string, unknown>;
	const out: Record<string, string> = {};
	for (const [field, pattern] of Object.entries(FILTER_RULES)) {
		const raw = filters[field];
		if (raw === undefined || raw === null || raw === "") continue;
		const value = String(raw).trim();
		if (value === "") continue;
		if (!pattern.test(value)) {
			throw new AppError(400, "INVALID_INPUT", `${field} is invalid`);
		}
		out[field] = value;
	}
	return out;
}

/**
 * Reads and clamps the paging window.
 * @param body - Untrusted JSON body.
 * @returns A non-negative start index and a limit within [1, MAX_LIMIT].
 */
export function parsePaging(body: unknown): {
	startIndex: number;
	limit: number;
} {
	const src = (body ?? {}) as { start_index?: unknown; limit?: unknown };
	const rawStart = Number(src.start_index ?? 0);
	const rawLimit = Number(src.limit ?? MAX_LIMIT);
	const startIndex =
		Number.isFinite(rawStart) && rawStart > 0 ? Math.floor(rawStart) : 0;
	const limit =
		Number.isFinite(rawLimit) && rawLimit > 0
			? Math.min(Math.floor(rawLimit), MAX_LIMIT)
			: MAX_LIMIT;
	return { startIndex, limit };
}

/**
 * Mounts the console's transaction-history endpoint.
 *
 * POST, not GET: the filters carry mobile numbers, account numbers, TIDs and
 * amounts, and a query string would put all of them into browser history, proxy
 * logs and this app's own access log (which records `path`).
 * @param app - The Hono app.
 * @param deps - Session verifier, Eko client, and config.
 */
export function mountTransactions(
	app: Hono<AppEnv>,
	deps: { sessions: Sessions; eko: EkoClient; cfg: Config },
): void {
	const { sessions, eko, cfg } = deps;

	/** Resolves the caller's mobile, or throws unless this is a developer session. */
	async function requireDeveloperSession(c: Context<AppEnv>): Promise<string> {
		const token = getCookie(c, ACCESS_COOKIE);
		const claim = token ? await sessions.verifyAccess(token) : null;
		if (!claim) throw new AppError(401, "NO_SESSION", "Not authenticated");
		if (claim.role !== "developer") {
			throw new AppError(
				403,
				"NOT_DEVELOPER_SESSION",
				"This account cannot view transactions.",
			);
		}
		return claim.sub;
	}

	/**
	 * POST /transactions/search → { rows, startIndex, limit, hasNext }
	 */
	app.post("/transactions/search", async (c) => {
		const mobile = await requireDeveloperSession(c);
		const body = await c.req.json().catch(() => ({}));
		const filters = parseFilters(body);
		const { startIndex, limit } = parsePaging(body);
		const xRealIp = c.req.header("x-real-ip");

		const profile = await eko.getProfile({ mobile, xRealIp });
		if (profile.kind !== "found") {
			// Only a fully-onboarded EPS business profile has transactions to show.
			// Anything else (mid-onboarding, inactive, upstream failure) must not be
			// reported as an empty history — that reads as "you have none".
			throw new AppError(
				403,
				"NO_PROFILE",
				"Your account isn't active yet, so it has no transactions.",
			);
		}

		// UNVERIFIED: `account_id`'s source. Eloka reads it from a login response
		// this backend never calls, so it is null here. Refuse to call upstream
		// without one rather than let wiring day discover the gap inside a generic
		// 502 — the fixture path is the only wired path today.
		// See docs/features/transaction-history.md §Unverified.
		const accountId: string | null = null;
		if (!cfg.eko.transactionsMock && accountId === null) {
			throw new AppError(
				501,
				"NOT_WIRED",
				"Transaction history isn't connected yet.",
			);
		}

		const { rows } = await eko.getTransactionHistory({
			identity: identityOf(profile.profile),
			accountId,
			startIndex,
			limit,
			filters,
			xRealIp,
		});

		// Full-page heuristic: upstream reports no total count, so a Next is offered
		// whenever the page came back full. On an exactly-full final page that costs
		// one empty page, which the console tolerates.
		const view: {
			rows: TransactionRow[];
			startIndex: number;
			limit: number;
			hasNext: boolean;
		} = { rows, startIndex, limit, hasNext: rows.length === limit };
		return c.json(view);
	});
}
