import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import type { Sessions } from "../auth/session";
import { ACCESS_COOKIE } from "../auth/session";
import { AppError } from "./errors";
import type { AppEnv } from "./requestId";

/**
 * The signed-in developer's mobile — the only identity a partner-facing route
 * ever trusts. Never read an account identifier from the request itself.
 *
 * Extracted from the three route modules that each had their own copy: the rule
 * (access cookie → verified claim → role must be `developer`) is one rule, and a
 * per-module copy is a per-module chance to weaken it.
 *
 * @param sessions - Session verifier.
 * @param c - The request context.
 * @param deniedMessage - Shown to a non-developer session; name the action.
 * @returns The caller's mobile (`claim.sub`).
 * @throws AppError 401 NO_SESSION when there is no valid access cookie.
 * @throws AppError 403 NOT_DEVELOPER_SESSION for an admin or signup session.
 */
export async function requireDeveloperSession(
	sessions: Sessions,
	c: Context<AppEnv>,
	deniedMessage: string,
): Promise<string> {
	const token = getCookie(c, ACCESS_COOKIE);
	const claim = token ? await sessions.verifyAccess(token) : null;
	if (!claim) throw new AppError(401, "NO_SESSION", "Not authenticated");
	if (claim.role !== "developer") {
		throw new AppError(403, "NOT_DEVELOPER_SESSION", deniedMessage);
	}
	return claim.sub;
}
