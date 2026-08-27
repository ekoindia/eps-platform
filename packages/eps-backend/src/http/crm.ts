import type { Context, Hono } from "hono";
import type { Sessions } from "../auth/session";
import type { EkoClient } from "../clients/eko";
import { stripSensitive } from "../clients/profile-fields";
import type { ZohoClient, ZohoLead } from "../clients/zoho";
import { isWritableLeadField, WRITABLE_LEAD_FIELDS } from "../clients/zoho";
import type { KV } from "../store/kv";
import { AppError } from "./errors";
import { enforceRateLimit, RL_WINDOW_SEC } from "./rateLimit";
import type { AppEnv } from "./requestId";
import { requireDeveloperSession } from "./session-guards";

/** Per-partner reads per window. A console page-load costs one. */
const CRM_READ_LIMIT = 60;
/** Per-partner writes per window. Saving a form costs one. */
const CRM_WRITE_LIMIT = 20;

/** Longest string this service will forward into a Lead field. */
const MAX_FIELD_LEN = 500;

const DENIED = "This account cannot view its CRM record.";

/**
 * Narrows an untrusted PATCH body to the writable Lead fields.
 *
 * Rejects rather than drops: an unknown key silently discarded looks to the
 * console exactly like a successful save. Zoho itself owns the deeper rules
 * (picklist membership, date format, per-field length) and reports them through
 * `updateLead`'s per-record result — this guard only enforces what must never
 * reach the CRM in the first place: unwritable fields and non-scalar values.
 *
 * @param body - Untrusted JSON body.
 * @returns The allow-listed fields, ready to send.
 * @throws AppError 400 when the body or any field is unusable.
 */
export function parseLeadPatch(body: unknown): Record<string, unknown> {
	if (typeof body !== "object" || body === null || Array.isArray(body)) {
		throw new AppError(
			400,
			"INVALID_BODY",
			"Expected an object of Lead fields.",
		);
	}
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(body)) {
		if (!isWritableLeadField(key)) {
			throw new AppError(
				400,
				"FIELD_NOT_WRITABLE",
				`"${key}" is not an editable field.`,
				{ writable: [...WRITABLE_LEAD_FIELDS] },
			);
		}
		if (value !== null && typeof value === "object") {
			throw new AppError(
				400,
				"INVALID_FIELD_VALUE",
				`"${key}" must be a text, number or boolean value.`,
			);
		}
		if (typeof value === "number" && !Number.isFinite(value)) {
			throw new AppError(
				400,
				"INVALID_FIELD_VALUE",
				`"${key}" is not a finite number.`,
			);
		}
		if (typeof value === "string" && value.length > MAX_FIELD_LEN) {
			throw new AppError(
				400,
				"INVALID_FIELD_VALUE",
				`"${key}" is longer than ${MAX_FIELD_LEN} characters.`,
			);
		}
		out[key] = value;
	}
	if (Object.keys(out).length === 0) {
		throw new AppError(400, "NO_FIELDS", "No fields to update.");
	}
	return out;
}

/**
 * The partner's own Lead record, as `{ id, fields }`.
 *
 * `fields` runs through `stripSensitive` for the same reason `userDetail` does —
 * it is a passthrough of an upstream bag, and a credential-shaped key must not
 * reach the browser.
 */
interface LeadView {
	id: string;
	fields: Record<string, unknown> | null;
}

function toView(id: string, lead: ZohoLead): LeadView {
	return { id, fields: stripSensitive(lead) };
}

/**
 * Read/update the signed-in partner's own Zoho CRM Lead.
 *
 * Two rules hold everywhere below:
 * - The record id comes from the partner's upstream profile
 *   (`user_detail.crm_lead_id`), never from the request. Note it is NOT the
 *   session's `zohoId`, which is the CRM *Contact* (`zoho_id` /
 *   `crm_contact_id`) and addresses a different module.
 * - These routes fail CLOSED. `ZohoClient.findLead` on the login path returns
 *   `false` when the CRM is unreachable, because a CRM outage must not block a
 *   login; here, an unreachable CRM is a 502 rather than an empty record that
 *   the console would render as "you have no details".
 *
 * CSRF: the access cookie is `SameSite=Lax` by default (`COOKIE_SAMESITE`), so a
 * cross-site PATCH never carries it. Same posture as the other cookie-authed
 * mutations in this service; deploying with `COOKIE_SAMESITE=None` would need a
 * token, which is why the deploy docs argue against it.
 *
 * @param app - The Hono app to mount on.
 * @param deps - Sessions, the Eko profile client, the Zoho client, KV, and
 *   whether Zoho is configured at all.
 */
export function mountCrm(
	app: Hono<AppEnv>,
	deps: {
		sessions: Sessions;
		eko: EkoClient;
		zoho: ZohoClient;
		kv: KV;
		enabled: boolean;
	},
): void {
	const { sessions, eko, zoho, kv, enabled } = deps;

	/**
	 * Session → rate limit → upstream profile → Lead id.
	 *
	 * Limits BEFORE the profile call: a limiter that runs after it lets a caller
	 * spend this service's upstream capacity before ever being told to slow down.
	 */
	async function resolveLeadId(
		c: Context<AppEnv>,
		limit: number,
		bucket: string,
	): Promise<string> {
		const mobile = await requireDeveloperSession(sessions, c, DENIED);
		await enforceRateLimit(
			kv,
			`rl:crm:${bucket}:${mobile}`,
			limit,
			RL_WINDOW_SEC,
		);
		if (!enabled) {
			throw new AppError(404, "CRM_DISABLED", "CRM is not available.");
		}
		const result = await eko.getProfile({
			mobile,
			xRealIp: c.req.header("x-real-ip"),
		});
		const profile =
			result.kind === "found" || result.kind === "onboarding"
				? result.profile
				: null;
		const leadId = String(profile?.userDetail?.crm_lead_id ?? "").trim();
		if (!leadId) {
			throw new AppError(
				404,
				"NO_CRM_LEAD",
				"No CRM record is linked to this account.",
			);
		}
		return leadId;
	}

	/**
	 * Maps a Zoho failure to a 502 without leaking its text: an upstream message
	 * can name CRM fields, users and validation rules.
	 */
	function crmUnavailable(c: Context<AppEnv>, err: unknown): AppError {
		console.error("[eps-backend] zoho crm call failed", {
			rid: c.get("rid"),
			err,
		});
		return new AppError(
			502,
			"CRM_UNAVAILABLE",
			"Could not reach the CRM. Please try again shortly.",
		);
	}

	/** GET /crm/lead → { id, fields } */
	app.get("/crm/lead", async (c) => {
		const leadId = await resolveLeadId(c, CRM_READ_LIMIT, "read");
		let lead: ZohoLead | null;
		try {
			lead = await zoho.getLead(leadId);
		} catch (err) {
			throw crmUnavailable(c, err);
		}
		if (!lead) {
			throw new AppError(
				404,
				"NO_CRM_LEAD",
				"No CRM record is linked to this account.",
			);
		}
		return c.json(toView(leadId, lead));
	});

	/**
	 * PATCH /crm/lead → { id, fields }
	 *
	 * `fields` is null when the write succeeded but the read-back did not: the
	 * change IS committed, and answering 502 there would invite the console to
	 * retry a save that already landed.
	 */
	app.patch("/crm/lead", async (c) => {
		const leadId = await resolveLeadId(c, CRM_WRITE_LIMIT, "write");
		const fields = parseLeadPatch(await c.req.json().catch(() => null));
		try {
			await zoho.updateLead(leadId, fields);
		} catch (err) {
			throw crmUnavailable(c, err);
		}
		try {
			const lead = await zoho.getLead(leadId);
			return c.json(lead ? toView(leadId, lead) : { id: leadId, fields: null });
		} catch (err) {
			console.error("[eps-backend] zoho crm read-back after write failed", {
				rid: c.get("rid"),
				err,
			});
			return c.json({ id: leadId, fields: null } satisfies LeadView);
		}
	});
}
