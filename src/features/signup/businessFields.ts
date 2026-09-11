/**
 * The 36 state values upstream accepts, captured verbatim from interaction 387
 * (state list) against UAT on 2026-07-16. Upstream returns `value` identical to
 * `label`, so one array serves both.
 *
 * These exact strings are what interaction 522 matches on. The quirks are
 * upstream's and are load-bearing: "PondiCherry" has that casing, Delhi is
 * spelled out with a "(UT)" suffix, "Andhra Pradesh (New)" comes last rather
 * than alphabetically, and there is no "Ladakh" entry. Do not correct them.
 *
 * ponytail: inlined rather than fetched — 36 static names, and the value is the
 * name itself, so there is nothing to look up. If this list ever drifts, swap in
 * a BFF route over interaction 387 (which needs no user identity).
 */
export const INDIAN_STATES: readonly string[] = [
	"Andaman & Nicobar Islands",
	"Arunachal Pradesh",
	"Assam",
	"Bihar",
	"Chandigarh",
	"Chhattisgarh",
	"Dadra and Nagar Haveli",
	"Daman and Diu",
	"Goa",
	"Gujarat",
	"Haryana",
	"Himachal Pradesh",
	"Jammu and Kashmir",
	"Jharkhand",
	"Karnataka",
	"Kerala",
	"Lakshadweep",
	"Madhya Pradesh",
	"Maharashtra",
	"Manipur",
	"Meghalaya",
	"Mizoram",
	"Nagaland",
	"National Capital Territory of Delhi (UT)",
	"Odisha",
	"PondiCherry",
	"Punjab",
	"Rajasthan",
	"Sikkim",
	"Tamil Nadu",
	"Telangana",
	"Tripura",
	"Uttar Pradesh",
	"Uttarakhand",
	"West Bengal",
	"Andhra Pradesh (New)",
];

/**
 * Company types upstream accepts, mirroring Eloka's `COMPANY_TYPE_OPTIONS`. The
 * values are NOT sequential by label — they are the exact codes interaction 522
 * matches on, so keep them verbatim (LLP is 4, not 2). The listing order is
 * ours, not upstream's: Sole Proprietorship is promoted to second, and
 * Individual (a distinct code, 7) sits last by choice.
 */
export const COMPANY_TYPES: readonly { label: string; value: string }[] = [
	{ label: "Private Limited", value: "1" },
	{ label: "Sole Proprietorship", value: "3" },
	{ label: "LLP (Limited Liability Partnership)", value: "4" },
	{ label: "Partnership", value: "2" },
	{ label: "Public Limited", value: "5" },
	{ label: "Individual", value: "7" },
];

/** One field of the Business Details form. */
export interface BusinessField {
	/** Submitted key — must match what interaction 522 expects. */
	name: string;
	label: string;
	/** `select` renders a dropdown over `options`; `text` renders an input. */
	kind: "text" | "select";
	options?: readonly { label: string; value: string }[];
	/** Optional helper line shown under the label. */
	description?: string;
	/** Optional in-field hint. Doubles as the empty option's text on a select. */
	placeholder?: string;
	required: boolean;
	pattern: RegExp;
	min: number;
	max: number;
	/** Shown when `pattern` fails. Length failures get their own message. */
	message: string;
	/** `inputMode`/`type` hint for the input; omitted for plain text. */
	inputMode?: "numeric" | "email";
	/** When true, the field renders read-only once the profile prefills it. */
	lockWhenPrefilled?: boolean;
	/**
	 * When true the field takes the whole row; otherwise it shares a row with
	 * its neighbour on `sm` and up. Groups render as a two-column grid, so this
	 * is what puts PIN code beside City while State and Street address run full
	 * width — laid out here, next to the field, rather than as a rule about
	 * which group a field happens to sit in.
	 */
	fullWidth?: boolean;
}

/**
 * Every field of the step, declared once. This array drives both the rendered
 * form and client-side validation, so adding a field is a one-line change.
 *
 * `name` and `company_type` are declared here — and so validated and submitted
 * with the rest — but are NOT listed in `BUSINESS_GROUPS` below: `BusinessStep`
 * renders them itself, in the verified-from-PAN box and the business-type
 * question respectively.
 *
 * The BFF re-validates all of this independently (`http/signup.ts`) — these
 * rules are for feedback, not enforcement.
 */
export const BUSINESS_FIELDS: readonly BusinessField[] = [
	{
		name: "name",
		label: "Company/Firm's Name",
		kind: "text",
		description:
			"For an individual or sole proprietorship, enter your own name.",
		required: true,
		pattern: /^[-a-zA-Z0-9 ,./:]+$/,
		min: 2,
		max: 100,
		message: "Use only letters, numbers and , . / : -",
		lockWhenPrefilled: true,
		fullWidth: true,
	},
	{
		name: "company_type",
		label: "Business Type",
		kind: "select",
		options: COMPANY_TYPES,
		placeholder: "Select business type…",
		required: true,
		// Every value in COMPANY_TYPES, which is 1-5 plus Individual's 7. Keep in
		// step with that array and with the BFF mirror in `http/signup.ts`.
		pattern: /^(?:[1-5]|7)$/,
		min: 1,
		max: 1,
		message: "Select a business type",
		fullWidth: true,
	},
	{
		name: "authorized_signatory_name",
		label: "Authorised signatory",
		kind: "text",
		placeholder: "Full name",
		required: true,
		pattern: /^[a-zA-Z][a-zA-Z .]{1,49}$/,
		min: 2,
		max: 50,
		message: "Use letters, spaces and initials only",
	},
	{
		name: "email",
		label: "Work email",
		kind: "text",
		placeholder: "you@organisation.in",
		required: true,
		pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
		min: 5,
		max: 100,
		message: "Enter a valid email address",
		inputMode: "email",
	},
	{
		name: "current_address_pincode",
		label: "PIN code",
		kind: "text",
		// placeholder: "560001",
		required: true,
		pattern: /^\d{6}$/,
		min: 6,
		max: 6,
		message: "Enter a valid 6-digit PIN code",
		inputMode: "numeric",
	},
	{
		name: "current_address_district",
		label: "City",
		kind: "text",
		placeholder: "Fills from the PIN code",
		required: true,
		pattern: /^[a-zA-Z ]+$/,
		min: 2,
		max: 50,
		message: "Use letters and spaces only",
	},
	{
		name: "current_address_state",
		label: "State",
		kind: "select",
		options: INDIAN_STATES.map((s) => ({ label: s, value: s })).sort((a, b) =>
			a.label.localeCompare(b.label),
		),
		placeholder: "Select state…",
		required: true,
		pattern: /^.+$/,
		min: 2,
		max: 60,
		message: "Select a state",
		fullWidth: true,
	},
	{
		// The only address line. The optional "Floor, unit, landmark" second line
		// was dropped: it was one more box on an already long form, and upstream
		// takes 200 characters here, which is room for both parts of an address.
		// The BFF still accepts `current_address_line2` (optional) so an older
		// cached client keeps working.
		name: "current_address_line1",
		label: "Street address",
		kind: "text",
		placeholder: "Floor, building, street, area",
		required: true,
		pattern: /^.+$/,
		min: 10,
		max: 200,
		message: "Enter a valid address",
		fullWidth: true,
	},
];

/**
 * Fields grouped for display, in render order.
 *
 * `name` and `company_type` are deliberately absent — see `BUSINESS_FIELDS`.
 */
export const BUSINESS_GROUPS: readonly { heading: string; fields: string[] }[] =
	[
		{
			heading: "Who signs the agreement",
			fields: ["authorized_signatory_name", "email"],
		},
		{
			heading: "Registered address",
			fields: [
				"current_address_pincode",
				"current_address_district",
				"current_address_state",
				"current_address_line1",
			],
		},
	];

/**
 * Validates one field's value against its spec.
 *
 * @param field - The field's spec entry.
 * @param value - The current (untrimmed) input value.
 * @returns An error message, or `null` when the value is acceptable.
 */
export function validateField(
	field: BusinessField,
	value: string,
): string | null {
	const trimmed = value.trim();
	if (!trimmed) {
		return field.required ? `${field.label} is required` : null;
	}
	if (trimmed.length < field.min) {
		return `Must be at least ${field.min} characters`;
	}
	if (trimmed.length > field.max) {
		return `Must be at most ${field.max} characters`;
	}
	return field.pattern.test(trimmed) ? null : field.message;
}
