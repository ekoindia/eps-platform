/**
 * The Zoho CRM Lead fields this service exposes — the ONE whitelist for both
 * directions.
 *
 * `GET /crm/lead` returns only these fields, so nothing else on the Lead (owner,
 * status, sales notes, scoring) ever reaches a browser or its cache. `PATCH
 * /crm/lead` accepts only the ones marked writable, checked against Zoho's own
 * type and length for each.
 *
 * Every `api_name`, type and length here was read from the live org's
 * `GET /crm/v2/settings/fields?module=Leads` on 2026-11-02. Re-check there
 * before adding a field: Zoho accepts an unknown `api_name` silently and writes
 * nothing.
 */

/** How a field may be written by the partner it belongs to. */
export type LeadFieldWrite =
	/** Read-only: refused on PATCH. */
	| "never"
	/** Freely overwritten with a valid value (never emptied — see crm.ts). */
	| "always"
	/**
	 * Accepted only while the Lead's value is still empty. For attribution data
	 * a partner may help capture once but must not later rewrite.
	 */
	| "once";

export interface LeadFieldSpec {
	/** Zoho data type; decides which JSON type a write must be. */
	type:
		| "text"
		| "textarea"
		| "website"
		| "integer"
		| "currency"
		| "percent"
		| "picklist"
		| "multiselect";
	/** Zoho's `length` for the field — the longest value it will store. */
	maxLength: number;
	write: LeadFieldWrite;
	/**
	 * For a writable picklist: the exact values a partner may choose. May be a
	 * subset of what Zoho holds — see `Activation_Fee_Status`.
	 */
	options?: readonly string[];
	/**
	 * For an integer: the range a partner may write, tighter than `maxLength`
	 * alone says. Absent means any non-negative whole number that fits.
	 */
	range?: { min: number; max: number };
}

/** Indian states and UTs, as the org's `States` picklist spells them. */
const STATES = [
	"Uttar Pradesh",
	"Maharashtra",
	"Bihar",
	"West Bengal",
	"Madhya Pradesh",
	"Tamil Nadu",
	"Rajasthan",
	"Karnataka",
	"Gujarat",
	"Andhra Pradesh",
	"Odisha",
	"Telangana",
	"Kerala",
	"Jharkhand",
	"Assam",
	"Punjab",
	"Chhattisgarh",
	"Haryana",
	"Delhi",
	"Jammu and Kashmir",
	"Uttarakhand",
	"Himachal Pradesh",
	"Tripura",
	"Meghalaya",
	"Manipur",
	"Nagaland",
	"Goa",
	"Arunachal Pradesh",
	"Puducherry",
	"Mizoram",
	"Chandigarh",
	"Sikkim",
	"Dadra and Nagar Haveli",
	"Daman and Diu",
	"Andaman and Nicobar Islands",
	"Ladakh",
	"Lakshadweep",
] as const;

/** Short attribution text field — write-once, Zoho length 255. */
const ATTRIBUTION: LeadFieldSpec = {
	type: "text",
	maxLength: 255,
	write: "once",
};

/**
 * Picklist values are byte-for-byte Zoho's: the dashes are EN DASH (U+2013),
 * the rupee is U+20B9, and the irregular spacing ("₹ 5 – 25 crore" beside
 * "₹1 crore – 5 crore") is Zoho's, not a typo. One character off is a
 * different option — do not tidy them.
 */
export const LEAD_FIELDS = {
	// ── Shown and edited on /console/profile ──────────────────────────────
	Industry: {
		type: "picklist",
		maxLength: 120,
		write: "always",
		// 14 of the org's 30; the rest are legacy. A Lead holding one keeps it —
		// the console only ever sends fields the partner changed.
		options: [
			"Financial Services",
			"IT/Software",
			"Professional Services",
			"Logistics",
			"Healthcare",
			"Education",
			"Hospitality",
			"Agriculture",
			"Manufacturing",
			"Construction",
			"NGO",
			"Small/Medium Enterprise",
			"Retail/Wholesale",
			"Others",
		],
	},
	Annual_Turnover: {
		type: "picklist",
		maxLength: 120,
		write: "always",
		options: [
			"Pre-revenue",
			"Under ₹25 lakh",
			"₹25 lakh – ₹1 crore",
			"₹1 crore – 5 crore",
			"₹ 5 – 25 crore",
			"Over ₹ 25 crore",
			"Prefer not to disclose",
		],
	},
	Number_of_Employees: {
		type: "picklist",
		maxLength: 120,
		write: "always",
		options: [
			"1",
			"2 – 10",
			"11 – 50",
			"51 – 200",
			"201 – 500",
			"Over 500",
			"Prefer not to disclose",
		],
	},
	Number_of_Clients: {
		type: "picklist",
		maxLength: 120,
		write: "always",
		options: [
			"1 – 50",
			"51 – 500",
			"501 – 5000",
			"5001 – 50,000",
			"Above 50,000",
			"Not sure",
		],
	},
	GST_No: { type: "text", maxLength: 255, write: "always" },
	Website: { type: "website", maxLength: 255, write: "always" },
	Mobile_App_Name: { type: "text", maxLength: 255, write: "always" },
	// 1–15: the console's director picker range (`directors.ts` in the app).
	Count_of_Directors: {
		type: "integer",
		maxLength: 2,
		write: "always",
		range: { min: 1, max: 15 },
	},
	Authorized_Signatory_Full_name: {
		type: "text",
		maxLength: 255,
		write: "always",
	},

	// ── Partner and location details ──────────────────────────────────────
	Description: { type: "textarea", maxLength: 32000, write: "always" },
	City: { type: "text", maxLength: 100, write: "always" },
	// The org's field is `States` (plural). Its two placeholder options,
	// "Option 1" and "Option 2", are deliberately not offered.
	States: {
		type: "picklist",
		maxLength: 120,
		write: "always",
		options: STATES,
	},
	Zip_Code: { type: "text", maxLength: 30, write: "always" },

	// ── Identity and products: read-only ──────────────────────────────────
	// The partner's Eko code links this Lead to their Eko account; a partner
	// rewriting it would break that link.
	Eko_Code: { type: "text", maxLength: 255, write: "never" },
	// Read-only until the accepted list (the EPS products currently live) is
	// settled — the org's 89 options include near-duplicates.
	Pro_Required: { type: "multiselect", maxLength: 1000, write: "never" },

	// ── Activation fee: the partner's claim, which finance reconciles ─────
	Activation_Fee_Status: {
		type: "picklist",
		maxLength: 120,
		write: "always",
		// Zoho also holds Paid / Unpaid / Partially paid. Those are finance's
		// verdict; a partner may only say they have paid.
		options: ["Payment claimed"],
	},
	Activation_Fee_Paid_INR: { type: "currency", maxLength: 16, write: "always" },
	Activation_Fee_Discount: { type: "percent", maxLength: 5, write: "always" },
	UTR_No: { type: "text", maxLength: 255, write: "always" },

	// ── Marketing attribution: write-once ─────────────────────────────────
	First_Visited_URL: { type: "website", maxLength: 3000, write: "once" },
	Source_Website: { type: "website", maxLength: 450, write: "once" },
	Ad_ID: ATTRIBUTION,
	SEO_Page_Name: ATTRIBUTION,
	Campaign_Name: ATTRIBUTION,
	utm_source: ATTRIBUTION,
	utm_medium: ATTRIBUTION,
	utm_campaign: ATTRIBUTION,
	utm_term: ATTRIBUTION,
	utm_content: ATTRIBUTION,
	utm_adgroup: ATTRIBUTION,
	utm_matchtype: { type: "text", maxLength: 2, write: "once" },
	utm_device: { type: "text", maxLength: 2, write: "once" },
} as const satisfies Record<string, LeadFieldSpec>;

export type LeadFieldName = keyof typeof LEAD_FIELDS;

/** The spec for `name`, or undefined when it is not on the whitelist. */
export function leadFieldSpec(name: string): LeadFieldSpec | undefined {
	return Object.hasOwn(LEAD_FIELDS, name)
		? (LEAD_FIELDS as Record<string, LeadFieldSpec>)[name]
		: undefined;
}

/**
 * The selectable options per writable picklist, served with every
 * `/crm/lead` response so the console's dropdowns offer exactly what PATCH
 * accepts.
 */
export const LEAD_PICKLISTS: Readonly<Record<string, readonly string[]>> =
	Object.fromEntries(
		Object.entries(LEAD_FIELDS as Record<string, LeadFieldSpec>)
			.filter(([, spec]) => spec.options)
			.map(([name, spec]) => [name, spec.options!]),
	);

/**
 * `lead` narrowed to the whitelist. A missing key comes back as `null`, so
 * the browser can tell "known field, unset" from "not a field we serve".
 */
export function pickLeadFields(
	lead: Record<string, unknown>,
): Record<string, unknown> {
	return Object.fromEntries(
		Object.keys(LEAD_FIELDS).map((name) => [name, lead[name] ?? null]),
	);
}
