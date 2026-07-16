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
 * matches on, so keep them verbatim (LLP is 4, not 2).
 */
export const COMPANY_TYPES: readonly { label: string; value: string }[] = [
	{ label: "Private Ltd", value: "1" },
	{ label: "LLP", value: "4" },
	{ label: "Partnership", value: "2" },
	{ label: "Sole Proprietorship", value: "3" },
	{ label: "Public Limited", value: "5" },
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
	required: boolean;
	pattern: RegExp;
	min: number;
	max: number;
	/** Shown when `pattern` fails. Length failures get their own message. */
	message: string;
	/** `inputMode`/`type` hint for the input; omitted for plain text. */
	inputMode?: "numeric" | "email";
}

/**
 * Every field of the step, declared once. This array drives both the rendered
 * form and client-side validation, so adding a field is a one-line change.
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
	},
	{
		name: "company_type",
		label: "Company Type",
		kind: "select",
		options: COMPANY_TYPES,
		required: true,
		pattern: /^[1-5]$/,
		min: 1,
		max: 1,
		message: "Select a company type",
	},
	{
		name: "authorized_signatory_name",
		label: "Director / Authorised Signatory's Full Name",
		kind: "text",
		description: "Used for signing the agreement.",
		required: true,
		pattern: /^[a-zA-Z][a-zA-Z .]{1,49}$/,
		min: 2,
		max: 50,
		message: "Use letters, spaces and initials only",
	},
	{
		name: "email",
		label: "Email Address",
		kind: "text",
		description: "Used for communication and agreement delivery.",
		required: true,
		pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
		min: 5,
		max: 100,
		message: "Enter a valid email address",
		inputMode: "email",
	},
	{
		name: "current_address_line1",
		label: "Registered Business Address (Line 1)",
		kind: "text",
		required: true,
		pattern: /^.+$/,
		min: 10,
		max: 200,
		message: "Enter a valid address",
	},
	{
		name: "current_address_line2",
		label: "Registered Business Address (Line 2, optional)",
		kind: "text",
		required: false,
		pattern: /^.*$/,
		min: 0,
		max: 200,
		message: "Enter a valid address",
	},
	{
		name: "current_address_district",
		label: "City",
		kind: "text",
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
		required: true,
		pattern: /^.+$/,
		min: 2,
		max: 60,
		message: "Select a state",
	},
	{
		name: "current_address_pincode",
		label: "Pincode",
		kind: "text",
		required: true,
		pattern: /^\d{6}$/,
		min: 6,
		max: 6,
		message: "Enter a valid 6-digit pincode",
		inputMode: "numeric",
	},
];

/** Fields grouped for display, so nine inputs don't render as one wall. */
export const BUSINESS_GROUPS: readonly { heading: string; fields: string[] }[] =
	[
		{ heading: "Business", fields: ["name", "company_type"] },
		{
			heading: "Contact",
			fields: ["authorized_signatory_name", "email"],
		},
		{
			heading: "Address",
			fields: [
				"current_address_line1",
				"current_address_line2",
				"current_address_district",
				"current_address_state",
				"current_address_pincode",
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
