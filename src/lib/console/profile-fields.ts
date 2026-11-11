import { ApiError, authClient, type Profile } from "@/lib/auth/client";
import { profileCompanyType } from "@/lib/auth/identity";
import { DIRECTOR_MAX, directorRule } from "@/lib/connect/directors";
import type { CrmLeadState } from "@/lib/crm/lead-store";
import { useCrmLead } from "@/lib/crm/use-crm-lead";

/**
 * The partner's profile fields, configured once: what each is called, which
 * card it sits in on /console/profile, the question Console Home asks to fill
 * it, how urgently, and where an answer is stored.
 *
 * /console/profile renders and edits from this list; Console Home's profile
 * card asks its empty questions one at a time and draws its strength meter
 * from it. Adding a field here adds it to both. See
 * `docs/features/profile-fields.md`.
 */

/**
 * How a field is edited, and the rule a typed value must pass. Picklist
 * options are NOT here — they come from the backend with the CRM record.
 */
export type FieldKind = "picklist" | "text" | "gstin" | "url" | "integer";

/** How soon Console Home asks: 2 high, 1 medium, 0 low. */
export type FieldPriority = 0 | 1 | 2;

/** The /console/profile card a field sits in, in page order. */
export const PROFILE_SECTIONS = [
	"Business Profile",
	"Legal & Compliance",
	"Contact & Online Presence",
] as const;
export type ProfileSection = (typeof PROFILE_SECTIONS)[number];

/**
 * Where an answer is written. A field may name either store or both.
 *
 * - `crm` — the Zoho Lead field's `api_name`, written via `PATCH /crm/lead`.
 * - `simplibank` — the Eko profile field, written via `PATCH /profile`
 *   (interaction 369 for `gstin`). The backend whitelists what it accepts.
 *
 * With both, the CRM is written first and SimpliBank second — see
 * `writeProfileStores`.
 */
export interface FieldStores {
	crm?: string;
	simplibank?: string;
}

/** One profile field. */
export interface ProfileField {
	/** Stable id: the CRM `api_name` for CRM fields, else a slug. */
	key: string;
	label: string;
	section: ProfileSection;
	priority: FieldPriority;
	kind: FieldKind;
	/** What Console Home asks. Absent → never asked (read-only fields). */
	question?: string;
	/** Absent → read-only. */
	saveTo?: FieldStores;
	/**
	 * Fixed choices for a field that is not a CRM picklist — the director
	 * count's range, say. Values keep the field's `kind`, so an integer field
	 * still saves a number.
	 */
	options?: readonly string[];
	/** Profile-sourced value, for a read-only field. */
	read?: (profile: Profile | null) => string | null;
}

/** An http(s) URL — the only kind the console will render as a link or save. */
export const HTTP_URL = /^https?:\/\/\S+$/i;

/** GSTIN: state code, PAN, entity number, `Z`, checksum. */
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** Zoho's `length` for the free-text Lead fields. */
export const MAX_TEXT_LEN = 255;

/**
 * The director row for this profile: dropped for a sole proprietor or an
 * individual, read-only for an OPC, else asked within the type's range — the
 * same rule the Documents page asks by (see `directors.ts`).
 * @param profile - The signed-in developer's profile, or null.
 * @returns Zero or one field.
 */
function directorFields(profile: Profile | null): ProfileField[] {
	const rule = directorRule(profile);
	const base = {
		key: "Count_of_Directors",
		section: "Legal & Compliance",
		priority: 2,
		kind: "integer",
	} as const;
	if (rule.kind === "hidden") return [];
	if (rule.kind === "fixed") {
		return [
			{
				...base,
				label: "Number of Directors",
				read: () => "1 (One Person Company)",
			},
		];
	}
	return [
		{
			...base,
			label: `Number of ${rule.noun.many.replace(/\b\w/g, (c) => c.toUpperCase())}`,
			question: `How many ${rule.noun.many} does your business have?`,
			saveTo: { crm: "Count_of_Directors" },
			options: Array.from({ length: rule.max - rule.min + 1 }, (_, i) =>
				String(rule.min + i),
			),
		},
	];
}

/**
 * Every profile field that applies to this partner, in page order.
 * @param profile - The signed-in developer's profile, or null.
 * @returns The fields, grouped by section in `PROFILE_SECTIONS` order.
 */
export function profileFields(profile: Profile | null): ProfileField[] {
	return [
		{
			key: "company_type",
			label: "Company Type",
			section: "Business Profile",
			priority: 0,
			kind: "text",
			read: (p) => profileCompanyType(p),
		},
		{
			key: "Industry",
			label: "Industry",
			section: "Business Profile",
			priority: 2,
			kind: "picklist",
			question: "Which industry is your business in?",
			saveTo: { crm: "Industry" },
		},
		{
			key: "Annual_Turnover",
			label: "Annual Turnover",
			section: "Business Profile",
			priority: 1,
			kind: "picklist",
			question: "What is your annual turnover?",
			saveTo: { crm: "Annual_Turnover" },
		},
		{
			key: "Number_of_Employees",
			label: "Employees",
			section: "Business Profile",
			priority: 1,
			kind: "picklist",
			question: "How many people work in your business?",
			saveTo: { crm: "Number_of_Employees" },
		},
		{
			key: "Number_of_Clients",
			label: "Clients",
			section: "Business Profile",
			priority: 0,
			kind: "picklist",
			question: "Roughly how many clients do you serve?",
			saveTo: { crm: "Number_of_Clients" },
		},
		{
			key: "GST_No",
			label: "GST Number",
			section: "Legal & Compliance",
			priority: 2,
			kind: "gstin",
			question: "What is your GST number?",
			saveTo: { crm: "GST_No", simplibank: "gstin" },
		},
		...directorFields(profile),
		{
			key: "Authorized_Signatory_Full_name",
			label: "Authorized Signatory",
			section: "Legal & Compliance",
			priority: 1,
			kind: "text",
			question: "Who is the authorized signatory?",
			saveTo: { crm: "Authorized_Signatory_Full_name" },
		},
		{
			key: "email",
			label: "Email",
			section: "Contact & Online Presence",
			priority: 0,
			kind: "text",
			read: (p) => p?.email?.trim() || null,
		},
		{
			key: "Website",
			label: "Website",
			section: "Contact & Online Presence",
			priority: 2,
			kind: "url",
			question: "What is your business website?",
			saveTo: { crm: "Website" },
		},
		{
			key: "Mobile_App_Name",
			label: "Mobile App",
			section: "Contact & Online Presence",
			priority: 0,
			kind: "text",
			question: "What is your mobile app called?",
			saveTo: { crm: "Mobile_App_Name" },
		},
	];
}

/**
 * The raw CRM value as an editable string — `""` for unset or non-scalar.
 * Kept unformatted (no digit grouping) because it is what an input shows.
 */
export function rawText(
	fields: Record<string, unknown> | null,
	name: string,
): string {
	const value = fields?.[name];
	if (typeof value === "number" && Number.isFinite(value)) return String(value);
	if (typeof value === "string") return value.trim();
	return "";
}

/**
 * One CRM value as display text, or null.
 *
 * The record is Zoho's, untyped: picklists arrive as strings, numeric fields as
 * numbers, unset fields as null. Anything else (a lookup object, a multi-select
 * array) is not a field the console renders, and stringifying it would print
 * "[object Object]".
 */
export function crmText(
	fields: Record<string, unknown> | null,
	name: string,
): string | null {
	const value = fields?.[name];
	if (typeof value === "number" && Number.isFinite(value)) {
		return value.toLocaleString("en-IN");
	}
	if (typeof value === "string" && value.trim()) return value.trim();
	return null;
}

/**
 * A field's current value as a string, `""` when unset.
 * @param field - The field.
 * @param profile - The developer's profile, for read-only fields.
 * @param crm - The CRM Lead's fields, or null when not loaded.
 */
export function fieldValue(
	field: ProfileField,
	profile: Profile | null,
	crm: Record<string, unknown> | null,
): string {
	if (field.read) return field.read(profile)?.trim() ?? "";
	return field.saveTo?.crm ? rawText(crm, field.saveTo.crm) : "";
}

/**
 * The choices a field offers: its own `options`, else the backend's picklist
 * for a picklist field. Undefined for a free-text field.
 * @param field - The field.
 * @param picklists - The backend's options per CRM picklist.
 */
export function fieldOptions(
	field: ProfileField,
	picklists: Record<string, readonly string[]>,
): readonly string[] | undefined {
	if (field.options) return field.options;
	if (field.kind === "picklist" && field.saveTo?.crm) {
		return picklists[field.saveTo.crm];
	}
	return undefined;
}

/**
 * Checks one draft value's shape; returns an error message or null. Empty
 * passes here — whether empty is allowed depends on the caller.
 */
export function validate(kind: FieldKind, value: string): string | null {
	if (!value) return null;
	// The only integer field is the director count, so its range is the rule.
	if (
		kind === "integer" &&
		(!/^\d{1,2}$/.test(value) || +value < 1 || +value > DIRECTOR_MAX)
	) {
		return `Enter a whole number from 1 to ${DIRECTOR_MAX}.`;
	}
	if (kind === "url" && !HTTP_URL.test(value)) {
		return "Enter a full address starting with https://";
	}
	if (kind === "gstin" && !GSTIN.test(value)) {
		return "Enter a valid 15-character GSTIN.";
	}
	if (value.length > MAX_TEXT_LEN) {
		return `Keep this under ${MAX_TEXT_LEN} characters.`;
	}
	return null;
}

/** Normalises a draft value the way it should be stored. */
export function normalise(kind: FieldKind, value: string): string {
	const trimmed = value.trim();
	return kind === "gstin" ? trimmed.toUpperCase() : trimmed;
}

/** The value as a store should receive it: an integer field sends a number. */
export function toPayload(kind: FieldKind, value: string): unknown {
	return kind === "integer" ? Number(value) : value;
}

/**
 * Checks one Console Home answer: never blank, one of the offered choices when
 * there are any, and the right shape.
 * @param field - The field being answered.
 * @param draft - What the partner picked or typed.
 * @param options - The field's choices, from `fieldOptions`.
 * @returns The value to save, or an error message.
 */
export function checkAnswer(
	field: ProfileField,
	draft: string,
	options: readonly string[] | undefined,
): { ok: true; payload: unknown } | { ok: false; error: string } {
	const value = normalise(field.kind, draft);
	if (!value) return { ok: false, error: "Add an answer, or skip this one." };
	if (options && !options.includes(value)) {
		return { ok: false, error: "Pick one of the choices." };
	}
	const error = validate(field.kind, value);
	return error
		? { ok: false, error }
		: { ok: true, payload: toPayload(field.kind, value) };
}

/**
 * The partner-facing message for a failed save. A 400/409 names the field in
 * plain words (the backend writes them for the console); anything else is the
 * CRM being unreachable.
 */
export function saveFailureMessage(error: unknown): string {
	if (error instanceof ProfileSyncError) return error.message;
	return error instanceof ApiError &&
		(error.httpStatus === 400 || error.httpStatus === 409)
		? error.message
		: "Couldn't save to our records. Please try again shortly.";
}

/**
 * SimpliBank writes that failed after their CRM write had landed, by
 * SimpliBank field. The next save retries them, even one with nothing else to
 * send — the CRM already holds the value, so the form shows nothing changed.
 * ponytail: in memory, so a reload forgets them; persist if drift shows up.
 */
const unsynced = new Map<string, unknown>();

/** True while a SimpliBank write is waiting to be retried. */
export function hasUnsyncedProfile(): boolean {
	return unsynced.size > 0;
}

/** Test hook: forgets pending SimpliBank retries. */
export function resetUnsyncedProfile(): void {
	unsynced.clear();
}

/**
 * The CRM saved, SimpliBank didn't. The answer is recorded (the field reads as
 * filled), so callers move on, but tell the partner and keep the write queued.
 */
export class ProfileSyncError extends Error {}

/**
 * Writes answers to every store their fields name: the CRM first, then the Eko
 * profile (SimpliBank), plus any SimpliBank write still pending from an earlier
 * failure.
 *
 * A CRM failure throws its `ApiError` before SimpliBank is tried. A SimpliBank
 * failure after the CRM landed throws `ProfileSyncError` and queues the write.
 * @param changes - Each field with its value from `checkAnswer`/`toPayload`.
 * @param updateCrm - `useCrmLead().update`, so the shared cache is patched.
 */
export async function writeProfileStores(
	changes: readonly { field: ProfileField; payload: unknown }[],
	updateCrm: (fields: Record<string, unknown>) => Promise<void>,
): Promise<void> {
	const crm: Record<string, unknown> = {};
	const simplibank: Record<string, unknown> = Object.fromEntries(unsynced);
	for (const { field, payload } of changes) {
		if (field.saveTo?.crm) crm[field.saveTo.crm] = payload;
		if (field.saveTo?.simplibank) simplibank[field.saveTo.simplibank] = payload;
	}
	if (Object.keys(crm).length > 0) await updateCrm(crm);
	if (Object.keys(simplibank).length === 0) return;
	try {
		await authClient.updateProfile(simplibank);
		for (const key of Object.keys(simplibank)) unsynced.delete(key);
	} catch (error) {
		for (const [key, value] of Object.entries(simplibank)) {
			unsynced.set(key, value);
		}
		const reason =
			error instanceof ApiError && error.httpStatus === 400
				? ` ${error.message}`
				: "";
		throw new ProfileSyncError(
			`Saved to our records, but your Eko profile wasn't updated.${reason} Save again to retry.`,
		);
	}
}

/** How filled-in a profile is. */
export interface ProfileStrength {
	filled: number;
	total: number;
	/** 0–100, rounded. */
	percent: number;
}

/**
 * How many of the applicable fields hold a value.
 * @param fields - From `profileFields`.
 * @param profile - The developer's profile.
 * @param crm - The CRM Lead's fields.
 */
export function profileStrength(
	fields: readonly ProfileField[],
	profile: Profile | null,
	crm: Record<string, unknown> | null,
): ProfileStrength {
	const total = fields.length;
	const filled = fields.filter(
		(f) => fieldValue(f, profile, crm) !== "",
	).length;
	return {
		filled,
		total,
		percent: total ? Math.round((filled / total) * 100) : 0,
	};
}

/**
 * The order Console Home asks in: highest priority first, shuffled within each
 * priority so partners don't all see the same question. Only fields with a
 * question and somewhere to save are included; emptiness is the caller's
 * filter, since it changes as answers land.
 * @param fields - From `profileFields`.
 * @param random - Source of randomness, injectable for tests.
 * @returns Field keys.
 */
export function questionOrder(
	fields: readonly ProfileField[],
	random: () => number = Math.random,
): string[] {
	const askable = fields.filter((f) => f.question && f.saveTo);
	// Fisher–Yates, then a stable sort by priority keeps each tier shuffled.
	const shuffled = [...askable];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled.sort((a, b) => b.priority - a.priority).map((f) => f.key);
}

/** What `useProfileFields` hands a component. */
export interface ProfileFieldsView {
	fields: ProfileField[];
	crm: CrmLeadState;
	valueOf: (field: ProfileField) => string;
	optionsOf: (field: ProfileField) => readonly string[] | undefined;
	/**
	 * Null until the CRM record is loaded: with it missing, CRM fields would
	 * read as empty and the meter would under-report.
	 */
	strength: ProfileStrength | null;
	/** Writes an answer from `checkAnswer` to every store the field names. */
	save: (field: ProfileField, payload: unknown) => Promise<void>;
}

/**
 * The partner's profile fields with their live values, from any console page.
 * @param profile - The signed-in developer's profile, or null.
 */
export function useProfileFields(profile: Profile | null): ProfileFieldsView {
	const { state: crm, update } = useCrmLead();
	const record = crm.status === "ok" ? crm.fields : null;
	const picklists = crm.status === "ok" ? crm.picklists : {};
	const fields = profileFields(profile);
	return {
		fields,
		crm,
		valueOf: (field) => fieldValue(field, profile, record),
		optionsOf: (field) => fieldOptions(field, picklists),
		strength: record ? profileStrength(fields, profile, record) : null,
		save: (field, payload) => writeProfileStores([{ field, payload }], update),
	};
}
