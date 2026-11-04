import { LEAD_FIELDS, type LeadFieldSpec } from "./lead-fields";

/** Marks a URL cut short to fit its field: what precedes it is incomplete. */
export const TRUNCATION_MARK = "…";

/**
 * `url` cut to at most `maxLength` characters, ending in `TRUNCATION_MARK`
 * when it had to be cut. A trimmed URL still names the page and its first
 * query params, where dropping it would lose everything; the mark tells a
 * reader the last param's value is not intact. Never leaves half a `%XX`
 * escape before the mark.
 * @param url - The full URL.
 * @param maxLength - The Zoho field's length.
 */
export function truncateUrl(url: string, maxLength: number): string {
	if (url.length <= maxLength) return url;
	const cut = url
		.slice(0, maxLength - TRUNCATION_MARK.length)
		.replace(/%[0-9A-Fa-f]?$/, "");
	return cut + TRUNCATION_MARK;
}

/**
 * Lead attribution fields derived from a visitor's first landing URL.
 *
 * A port of the CRM's own Deluge function `update_seo_utm_info_from_visitor_url`,
 * which fills these fields when a Zoho Form creates a Lead. Signups through the
 * console never pass that form, so the backend derives the same values itself.
 * Kept rule-for-rule with the Deluge so the two sources land identical data:
 *
 * - `SEO_Page_Name` — the path after the domain, without the leading `/`.
 * - `utm_source` — the `utm_source` param, else inferred from the click id:
 *   `fbclid` → `fb`, `li_fat_id` → `linkedin`, `gclid` → `google`.
 * - `utm_campaign` — `utm_campaign`, else Google Ads' `gad_campaignid`.
 * - `Ad_ID` — the click id, `gclid` > `fbclid` > `li_fat_id` (not the creative).
 * - `Campaign_Name` — the `campaign_name` param.
 * - The other `utm_*` fields — their param, verbatim.
 *
 * Departures, all deliberate: values arrive URL-decoded (`URLSearchParams`);
 * every field is derived from the FULL url, however long; `First_Visited_URL`
 * is stored trimmed (`truncateUrl`) when it exceeds its field, while any other
 * value too long for its field is dropped rather than truncated — a truncated
 * campaign or click id would look valid and mean nothing.
 *
 * @param url - The visitor's first landing URL, as the browser recorded it.
 * @returns Lead fields by `api_name`; empty when `url` does not parse.
 */
export function attributionFromUrl(url: string): Record<string, string> {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return {};
	}
	const param = (key: string) => parsed.searchParams.get(key)?.trim() || "";
	const firstOf = (...values: string[]) => values.find(Boolean) ?? "";

	const derived: Record<string, string> = {
		First_Visited_URL: truncateUrl(
			url,
			LEAD_FIELDS.First_Visited_URL.maxLength,
		),
		SEO_Page_Name: parsed.pathname.slice(1),
		utm_source: firstOf(
			param("utm_source"),
			param("fbclid") && "fb",
			param("li_fat_id") && "linkedin",
			param("gclid") && "google",
		),
		utm_content: param("utm_content"),
		utm_medium: param("utm_medium"),
		utm_campaign: firstOf(param("utm_campaign"), param("gad_campaignid")),
		utm_term: param("utm_term"),
		utm_adgroup: param("utm_adgroup"),
		utm_matchtype: param("utm_matchtype"),
		utm_device: param("utm_device"),
		Ad_ID: firstOf(param("gclid"), param("fbclid"), param("li_fat_id")),
		Campaign_Name: param("campaign_name"),
	};
	const specs = LEAD_FIELDS as Record<string, LeadFieldSpec>;
	return Object.fromEntries(
		Object.entries(derived).filter(
			([name, value]) => value && value.length <= specs[name].maxLength,
		),
	);
}
