import type { Hono } from "hono";
import type { Sessions } from "../auth/session";
import { type EkoClient, identityOf } from "../clients/eko";
import type { KV } from "../store/kv";
import { AppError } from "./errors";
import { enforceRateLimit, RL_WINDOW_SEC } from "./rateLimit";
import type { AppEnv } from "./requestId";
import { requireDeveloperSession } from "./session-guards";

/** Per-partner profile writes per window. Saving a form costs one. */
const PROFILE_WRITE_LIMIT = 20;

/** GSTIN: state code, PAN, entity number, `Z`, checksum. Same rule as the console. */
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/**
 * Checks a `PATCH /profile` body. `gstin` is the only writable field today;
 * anything else is refused by name rather than ignored, so a caller never
 * believes a field was saved when it was not.
 * @throws AppError 400 naming the problem.
 */
export function parseProfilePatch(body: unknown): { gstin: string } {
	if (!body || typeof body !== "object" || Array.isArray(body)) {
		throw new AppError(400, "INVALID_INPUT", "Send the fields to update.");
	}
	const extra = Object.keys(body).find((key) => key !== "gstin");
	if (extra) {
		throw new AppError(
			400,
			"FIELD_NOT_WRITABLE",
			`"${extra}" can't be updated here.`,
		);
	}
	const raw = (body as { gstin?: unknown }).gstin;
	const gstin = typeof raw === "string" ? raw.trim().toUpperCase() : "";
	if (!GSTIN.test(gstin)) {
		throw new AppError(
			400,
			"INVALID_FIELD_VALUE",
			"Enter a valid 15-character GSTIN.",
		);
	}
	return { gstin };
}

/**
 * Mounts `PATCH /profile`: writes the partner's own Eko (SimpliBank) profile.
 *
 * The console's profile-field config (`src/lib/console/profile-fields.ts`)
 * names this store as `saveTo.simplibank`; the CRM copy of the same field goes
 * through `PATCH /crm/lead` separately.
 * @param app - The Hono app.
 * @param deps - Session verifier, Eko client and rate-limit store.
 */
export function mountProfile(
	app: Hono<AppEnv>,
	deps: { sessions: Sessions; eko: EkoClient; kv: KV },
): void {
	const { sessions, eko, kv } = deps;

	/**
	 * PATCH /profile `{ gstin }` → `{ updated: { gstin } }`
	 *
	 * Acts as the caller, resolved from their own 151 profile, never from the
	 * request. Upstream's refusal (non-zero `status`) comes back as a 400 with
	 * its message, which is written for the partner; a transport failure is the
	 * app's generic 5xx.
	 */
	app.patch("/profile", async (c) => {
		const mobile = await requireDeveloperSession(
			sessions,
			c,
			"This account cannot update its profile.",
		);
		await enforceRateLimit(
			kv,
			`rl:profile:write:${mobile}`,
			PROFILE_WRITE_LIMIT,
			RL_WINDOW_SEC,
		);
		const { gstin } = parseProfilePatch(await c.req.json().catch(() => null));
		const xRealIp = c.req.header("x-real-ip");
		const profile = await eko.getProfile({ mobile, xRealIp });
		if (profile.kind !== "found") {
			throw new AppError(
				403,
				"NO_PROFILE",
				"Your account isn't active yet, so its profile can't be updated.",
			);
		}
		const result = await eko.updateGstin({
			gstin,
			identity: identityOf(profile.profile),
			xRealIp,
		});
		if (!result.ok) {
			throw AppError.fromUpstream(
				400,
				"PROFILE_UPDATE_REJECTED",
				result.message,
				{
					responseTypeId: result.responseTypeId,
				},
			);
		}
		c.header("Cache-Control", "no-store");
		return c.json({ updated: { gstin } });
	});
}
