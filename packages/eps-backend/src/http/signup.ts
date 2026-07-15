import type { Context, Hono } from "hono";
import { getCookie } from "hono/cookie";
import type { Sessions } from "../auth/session";
import { ACCESS_COOKIE } from "../auth/session";
import type { SignupService } from "../signup/service";
import { SignupStepError } from "../signup/service";
import { AppError } from "./errors";
import type { AppEnv } from "./requestId";

/** Indian PAN: five letters, four digits, one letter. */
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

/**
 * Mounts the self-serve signup routes.
 *
 * Every route requires a signup session and reads the mobile from the session
 * claim — never from the request body, so one signed-up user cannot drive
 * another's onboarding.
 */
export function mountSignup(
	app: Hono<AppEnv>,
	deps: { sessions: Sessions; signup: SignupService },
): void {
	const { sessions, signup } = deps;

	/** Resolves the caller's mobile, or throws unless this is a signup session. */
	async function requireSignupSession(c: Context<AppEnv>): Promise<string> {
		const token = getCookie(c, ACCESS_COOKIE);
		const claim = token ? await sessions.verifyAccess(token) : null;
		if (!claim) throw new AppError(401, "NO_SESSION", "Not authenticated");
		if (claim.role !== "signup") {
			throw new AppError(
				403,
				"NOT_SIGNUP_SESSION",
				"This account has already completed signup.",
			);
		}
		return claim.sub;
	}

	/** Maps a step failure to a 400 carrying the upstream's own message. */
	function toAppError(e: unknown): never {
		if (e instanceof SignupStepError) {
			throw new AppError(400, "STEP_FAILED", e.message);
		}
		throw e;
	}

	app.get("/signup/state", async (c) => {
		const mobile = await requireSignupSession(c);
		try {
			return c.json(await signup.getState(mobile, c.req.header("x-real-ip")));
		} catch (e) {
			toAppError(e);
		}
	});

	app.post("/signup/profile", async (c) => {
		const mobile = await requireSignupSession(c);
		try {
			return c.json(await signup.createProfile(mobile, c.req.header("x-real-ip")));
		} catch (e) {
			toAppError(e);
		}
	});

	app.post("/signup/pan", async (c) => {
		const mobile = await requireSignupSession(c);
		const { pan } = await c.req.json().catch(() => ({}));
		// Validate at the trust boundary; the client's check is only for feedback.
		const normalized = String(pan ?? "").toUpperCase();
		if (!PAN_PATTERN.test(normalized)) {
			throw new AppError(400, "INVALID_INPUT", "Enter a valid 10-character PAN.");
		}
		try {
			return c.json(
				await signup.submitPan(mobile, normalized, c.req.header("x-real-ip")),
			);
		} catch (e) {
			toAppError(e);
		}
	});

	app.post("/signup/pin", async (c) => {
		const mobile = await requireSignupSession(c);
		const { pin1, pin2 } = await c.req.json().catch(() => ({}));
		if (!pin1 || !pin2) {
			throw new AppError(400, "INVALID_INPUT", "Both PIN fields are required.");
		}
		try {
			return c.json(
				await signup.submitPin(
					mobile,
					String(pin1),
					String(pin2),
					c.req.header("x-real-ip"),
				),
			);
		} catch (e) {
			toAppError(e);
		}
	});
}
