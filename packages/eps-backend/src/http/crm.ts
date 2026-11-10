import type { Context, Hono } from "hono";
import type { Sessions } from "../auth/session";
import type { EkoClient } from "../clients/eko";
import {
	LEAD_FIELDS,
	LEAD_PICKLISTS,
	type LeadFieldSpec,
	leadFieldSpec,
	pickLeadFields,
} from "../clients/lead-fields";
import { attributionFromUrl, truncateUrl } from "../clients/lead-attribution";
import type { ZohoClient, ZohoLead } from "../clients/zoho";
import type { KV } from "../store/kv";
import { AppError } from "./errors";
import { enforceRateLimit, RL_WINDOW_SEC } from "./rateLimit";
import type { AppEnv } from "./requestId";
import {
	requireDeveloperSession,
	requirePartnerSession,
} from "./session-guards";

/** Per-partner reads per window. A cache miss in the console costs one. */
const CRM_READ_LIMIT = 60;
/** Per-partner writes per window. Saving a form costs one. */
const CRM_WRITE_LIMIT = 20;

const DENIED = "This account cannot view its CRM record.";

/** Names of every field a partner may write, for the 400 that names them. */
const WRITABLE = Object.entries(LEAD_FIELDS as Record<string, LeadFieldSpec>)
	.filter(([, spec]) => spec.write !== "never")
	.map(([name]) => name);

/** A Zoho value that counts as "set": anything but null, undefined or blank. */
function isSet(value: unknown): boolean {
	if (value === null || value === undefined) return false;
	if (typeof value === "string") return value.trim() !== "";
	if (Array.isArray(value)) return value.length > 0;
	return true;
}

function invalid(key: string, why: string, details?: Record<string, unknown>) {
	return new AppError(400, "INVALID_FIELD_VALUE", `"${key}" ${why}`, details);
}

/**
 * Checks one value against its field's Zoho type and length.
 * @throws AppError 400 INVALID_FIELD_VALUE naming the field.
 */
function checkValue(key: string, spec: LeadFieldSpec, value: unknown): void {
	switch (spec.type) {
		case "picklist":
			if (!spec.options?.includes(value as string)) {
				throw invalid(key, "must be one of the listed options.", {
					options: [...(spec.options ?? [])],
				});
			}
			return;
		case "integer":
			if (
				typeof value !== "number" ||
				!Number.isInteger(value) ||
				value < 0 ||
				String(value).length > spec.maxLength
			) {
				throw invalid(
					key,
					`must be a whole number of up to ${spec.maxLength} digits.`,
				);
			}
			if (spec.range && (value < spec.range.min || value > spec.range.max)) {
				throw invalid(
					key,
					`must be between ${spec.range.min} and ${spec.range.max}.`,
				);
			}
			return;
		case "currency":
			if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
				throw invalid(key, "must be a non-negative amount.");
			}
			return;
		case "percent":
			if (
				typeof value !== "number" ||
				!Number.isFinite(value) ||
				value < 0 ||
				value > 100
			) {
				throw invalid(key, "must be a percentage between 0 and 100.");
			}
			return;
		default:
			// text, textarea, website. URL shape stays Zoho's rule for website.
			if (typeof value !== "string") throw invalid(key, "must be text.");
			if (value.length > spec.maxLength) {
				throw invalid(key, `is longer than ${spec.maxLength} characters.`);
			}
	}
}

/**
 * Narrows an untrusted PATCH body to writable, well-typed Lead fields.
 *
 * Every key must be on the `LEAD_FIELDS` whitelist and not read-only, and every
 * value must fit that field's Zoho type and length. Rejects rather than drops:
 * an unknown key silently discarded looks to the console exactly like a
 * successful save.
 *
 * Nothing can be cleared: `null` and blank strings are refused. A partner may
 * replace a value with a valid one, never erase it — sales relies on these
 * fields staying filled, and the console never needs to send an empty value
 * (an unset field left unset is simply not a change).
 *
 * Write-once fields pass here; whether they are still empty needs the Lead,
 * which the route checks.
 *
 * @param body - Untrusted JSON body.
 * @returns The validated fields, ready to send.
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
		const spec = leadFieldSpec(key);
		if (!spec || spec.write === "never") {
			throw new AppError(
				400,
				"FIELD_NOT_WRITABLE",
				`"${key}" is not an editable field.`,
				{ writable: WRITABLE },
			);
		}
		if (!isSet(value)) {
			throw new AppError(
				400,
				"FIELD_REQUIRED",
				`"${key}" can't be left empty.`,
			);
		}
		checkValue(key, spec, value);
		out[key] = value;
	}
	if (Object.keys(out).length === 0) {
		throw new AppError(400, "NO_FIELDS", "No fields to update.");
	}
	return out;
}

/**
 * Longest URL the attribution route accepts. Above any real landing URL;
 * bounds the parse. A URL over its Zoho field but under this is trimmed.
 */
const ATTRIBUTION_URL_MAX = 8192;

/**
 * An absolute http(s) URL of at most `ATTRIBUTION_URL_MAX` chars, or null.
 * @param value - Untrusted body value.
 */
function httpUrl(value: unknown): string | null {
	if (typeof value !== "string" || value.length > ATTRIBUTION_URL_MAX)
		return null;
	try {
		const { protocol } = new URL(value);
		return protocol === "https:" || protocol === "http:" ? value : null;
	} catch {
		return null;
	}
}

/**
 * Narrows an untrusted `POST /crm/lead/attribution` body to Lead fields: the
 * attribution derived from `url`, plus `sourceWebsite` as `Source_Website`.
 * Both URLs are trimmed to their Zoho field with a trailing `…`
 * (`truncateUrl`) rather than refused. An unusable `sourceWebsite` is
 * dropped; an unusable `url` is a 400, since without it there is nothing to
 * record.
 * @param body - Untrusted JSON body `{ url, sourceWebsite? }`.
 * @throws AppError 400 INVALID_FIELD_VALUE when `url` is not an http(s) URL
 *   of at most `ATTRIBUTION_URL_MAX` characters.
 */
export function parseAttributionBody(body: unknown): Record<string, string> {
	const src =
		body && typeof body === "object" ? (body as Record<string, unknown>) : {};
	const url = httpUrl(src.url);
	if (!url) {
		throw invalid(
			"url",
			`must be an http(s) URL of up to ${ATTRIBUTION_URL_MAX} characters.`,
		);
	}
	const sourceWebsite = httpUrl(src.sourceWebsite);
	return {
		...attributionFromUrl(url),
		...(sourceWebsite
			? {
					Source_Website: truncateUrl(
						sourceWebsite,
						LEAD_FIELDS.Source_Website.maxLength,
					),
				}
			: {}),
	};
}

/** `GET /crm/lead` — the whitelisted fields of the partner's own Lead. */
interface LeadView {
	id: string;
	fields: Record<string, unknown>;
	picklists: typeof LEAD_PICKLISTS;
}

/** `PATCH /crm/lead` — the fields just written, for the client to merge. */
interface LeadUpdateView {
	id: string;
	updated: Record<string, unknown>;
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
		guard: typeof requireDeveloperSession = requireDeveloperSession,
	): Promise<string> {
		const mobile = await guard(sessions, c, DENIED);
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

	/**
	 * GET /crm/lead → { id, fields, picklists }
	 *
	 * `fields` is the Lead narrowed to `LEAD_FIELDS` — never the whole record.
	 * Signup sessions may read too: the wizard refreshes the Lead after every
	 * onboarding step, since upstream edits it as each step lands.
	 */
	app.get("/crm/lead", async (c) => {
		const leadId = await resolveLeadId(
			c,
			CRM_READ_LIMIT,
			"read",
			requirePartnerSession,
		);
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
		return c.json({
			id: leadId,
			fields: pickLeadFields(lead),
			picklists: LEAD_PICKLISTS,
		} satisfies LeadView);
	});

	/**
	 * PATCH /crm/lead → { id, updated }
	 *
	 * Answers with the fields just written rather than re-reading the Lead: the
	 * console merges them into its cache, so a re-read would only be a second
	 * Zoho call per save for data the client already has.
	 *
	 * Write-once fields cost one read first, to refuse them (409) when the Lead
	 * already holds a value. Only those writes pay for it.
	 */
	app.patch("/crm/lead", async (c) => {
		const leadId = await resolveLeadId(c, CRM_WRITE_LIMIT, "write");
		const fields = parseLeadPatch(await c.req.json().catch(() => null));
		const writeOnce = Object.keys(fields).filter(
			(key) => leadFieldSpec(key)?.write === "once",
		);
		if (writeOnce.length > 0) {
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
			const locked = writeOnce.find((key) => isSet(lead[key]));
			if (locked) {
				throw new AppError(
					409,
					"FIELD_ALREADY_SET",
					`"${locked}" is already recorded and can't be changed.`,
				);
			}
		}
		try {
			await zoho.updateLead(leadId, fields);
		} catch (err) {
			throw crmUnavailable(c, err);
		}
		return c.json({ id: leadId, updated: fields } satisfies LeadUpdateView);
	});

	/**
	 * POST /crm/lead/attribution → { id, updated }
	 *
	 * Records the visitor's marketing attribution — what the Zoho Form and its
	 * Deluge function used to capture — for Leads created by the console's own
	 * signup. Body `{ url, sourceWebsite? }`: `url` is the first landing URL the
	 * browser kept, and the backend derives the rest (`attributionFromUrl`).
	 *
	 * Fill-empty only, and never a 409: fields the Lead already holds are left
	 * out of the write, so the call is idempotent and the browser can repeat it
	 * every onboarding step without tracking what landed. `updated` lists what
	 * was actually written and may be `{}`.
	 *
	 * Not atomic: Zoho has no conditional update, so a value another writer sets
	 * between the read and the write here is overwritten. The window is one
	 * round trip and the values are equivalent marketing data, so it is
	 * accepted rather than locked.
	 *
	 * Open to signup sessions — the Lead appears mid-signup, at the PAN step.
	 */
	app.post("/crm/lead/attribution", async (c) => {
		const leadId = await resolveLeadId(
			c,
			CRM_WRITE_LIMIT,
			"write",
			requirePartnerSession,
		);
		const fields = parseAttributionBody(await c.req.json().catch(() => null));
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
		const updated = Object.fromEntries(
			Object.entries(fields).filter(([key]) => !isSet(lead[key])),
		);
		if (Object.keys(updated).length > 0) {
			try {
				await zoho.updateLead(leadId, updated);
			} catch (err) {
				throw crmUnavailable(c, err);
			}
		}
		return c.json({ id: leadId, updated } satisfies LeadUpdateView);
	});
}
