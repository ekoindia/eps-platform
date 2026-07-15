import type { Context, Hono } from "hono";
import { getCookie } from "hono/cookie";
import type { Sessions } from "../auth/session";
import { ACCESS_COOKIE } from "../auth/session";
import type { EkoClient } from "../clients/eko";
import type { ZohoClient } from "../clients/zoho";
import type { Config } from "../config";
import { buildMeView } from "../identity/me";
import type { SignupService, SignupState } from "../signup/service";
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
	deps: {
		sessions: Sessions;
		signup: SignupService;
		eko: EkoClient;
		zoho: ZohoClient;
		cfg: Config;
	},
): void {
	// `cfg` is accepted for interface parity with the rest of the BFF's mount
	// functions but no longer read here: the session upgrade below only mints
	// on a `found` profile, which always carries its own `orgId` (no
	// `cfg.eko.defaultOrgId` fallback needed).
	const { sessions, signup, eko, zoho } = deps;

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

	/**
	 * Sends `state` as the response, first upgrading a completed user off their
	 * signup session.
	 *
	 * The design spec requires: once onboarding is done (`profile.onboarding
	 * === 0`), the BFF mints a real developer session in place of the signup
	 * session — otherwise the wizard's next `/me` call still sees
	 * `role === "signup"` and re-renders itself forever. This is the one place
	 * that happens: every signup route funnels its successful response through
	 * here, including `/signup/state`, so a user who finished onboarding but
	 * still holds a stale signup cookie (e.g. reloaded mid-navigation) gets
	 * upgraded on their next visit too, not only at the instant of PIN submit.
	 *
	 * The minted claim mirrors `POST /auth/otp/verify`'s `found`-profile branch
	 * exactly (same shape, same cookie helpers) so the two paths converge on one
	 * kind of developer session.
	 *
	 * If the upgrade's profile re-fetch fails, the request still succeeds with
	 * the (unupgraded) `done` state — onboarding itself already succeeded
	 * upstream, and the user can retry the upgrade on their next
	 * `/signup/state` call rather than seeing this request fail.
	 */
	async function respond(
		c: Context<AppEnv>,
		mobile: string,
		state: SignupState,
	): Promise<Response> {
		if (state.status === "done") {
			try {
				const profile = await eko.getProfile({
					mobile,
					xRealIp: c.req.header("x-real-ip"),
				});
				// Only a genuinely `found` profile may mint a developer session.
				// `buildMeView` never throws — `inactive` resolves to
				// `{state:"inactive"}` and `not_allowed`/`error` both resolve to
				// `{state:"unknown", profile:null}` — so gating on its output would
				// silently mint a session for exactly the profiles
				// `POST /auth/otp/verify` refuses outright (403 ACCOUNT_INACTIVE /
				// 403 NOT_ALLOWED / 502). The realistic trigger is a transient
				// upstream flake (`error`): without this guard it would upgrade an
				// unverified profile. No upgrade here just means the next
				// /signup/state call retries it.
				if (profile.kind !== "found") return c.json(state);
				const view = await buildMeView(mobile, profile, (m) => zoho.findLead(m));
				const claim = {
					sub: mobile,
					role: "developer" as const,
					// A `found` profile always carries a real orgId — no default-org
					// fallback needed (unlike the `unknown`/`inactive` kinds above).
					orgId: profile.profile.orgId,
					zohoId: view.zohoId ?? undefined,
				};
				const access = await sessions.mintAccess(claim);
				const refresh = await sessions.issueRefresh(claim);
				c.header("Set-Cookie", sessions.accessCookie(access), { append: true });
				c.header("Set-Cookie", sessions.refreshCookie(refresh), { append: true });
			} catch {
				// ponytail: onboarding already succeeded upstream — never fail this
				// request over the upgrade. The signup cookie stays valid and the
				// next /signup/state call retries the upgrade.
			}
		}
		return c.json(state);
	}

	app.get("/signup/state", async (c) => {
		const mobile = await requireSignupSession(c);
		try {
			return await respond(c, mobile, await signup.getState(mobile, c.req.header("x-real-ip")));
		} catch (e) {
			toAppError(e);
		}
	});

	app.post("/signup/profile", async (c) => {
		const mobile = await requireSignupSession(c);
		try {
			return await respond(
				c,
				mobile,
				await signup.createProfile(mobile, c.req.header("x-real-ip")),
			);
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
			return await respond(
				c,
				mobile,
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
			return await respond(
				c,
				mobile,
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
