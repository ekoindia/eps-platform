import { describe, expect, it } from "vitest";
import { attributionFromUrl, truncateUrl } from "./lead-attribution";

describe("attributionFromUrl", () => {
	it("derives every field from a Google Ads landing", () => {
		const url =
			"https://eps.eko.in/aeps/?gclid=G1&utm_source=gads&utm_medium=cpc&utm_campaign=aeps-q4&utm_term=aeps%20api&utm_content=ad1&utm_adgroup=core&utm_matchtype=e&utm_device=m&campaign_name=AEPS%20Q4";
		expect(attributionFromUrl(url)).toEqual({
			First_Visited_URL: url,
			SEO_Page_Name: "aeps/",
			utm_source: "gads",
			utm_medium: "cpc",
			utm_campaign: "aeps-q4",
			utm_term: "aeps api",
			utm_content: "ad1",
			utm_adgroup: "core",
			utm_matchtype: "e",
			utm_device: "m",
			Ad_ID: "G1",
			Campaign_Name: "AEPS Q4",
		});
	});

	it("infers utm_source and Ad_ID from the click id, gclid first", () => {
		expect(attributionFromUrl("https://eps.eko.in/?fbclid=F1")).toMatchObject({
			utm_source: "fb",
			Ad_ID: "F1",
		});
		expect(
			attributionFromUrl("https://eps.eko.in/?li_fat_id=L1"),
		).toMatchObject({ utm_source: "linkedin", Ad_ID: "L1" });
		// Deluge order: source fb > linkedin > google, but Ad_ID gclid first.
		expect(
			attributionFromUrl("https://eps.eko.in/?gclid=G1&fbclid=F1"),
		).toMatchObject({ utm_source: "fb", Ad_ID: "G1" });
	});

	it("falls back to gad_campaignid for utm_campaign", () => {
		expect(
			attributionFromUrl("https://eps.eko.in/?gad_campaignid=123&gclid=G"),
		).toMatchObject({ utm_campaign: "123", utm_source: "google" });
	});

	it("keeps an organic landing to URL + page name, and skips the root path", () => {
		expect(attributionFromUrl("https://eps.eko.in/pricing/")).toEqual({
			First_Visited_URL: "https://eps.eko.in/pricing/",
			SEO_Page_Name: "pricing/",
		});
		expect(attributionFromUrl("https://eps.eko.in/")).toEqual({
			First_Visited_URL: "https://eps.eko.in/",
		});
	});

	it("drops values too long for their Zoho field, and unparseable URLs", () => {
		expect(
			attributionFromUrl("https://eps.eko.in/?utm_matchtype=exact"),
		).not.toHaveProperty("utm_matchtype");
		expect(attributionFromUrl("not a url")).toEqual({});
	});
});

describe("truncateUrl", () => {
	it("leaves a URL that fits untouched", () => {
		expect(truncateUrl("https://eps.eko.in/?a=1", 23)).toBe(
			"https://eps.eko.in/?a=1",
		);
	});

	it("cuts to the field's length, ending in an ellipsis", () => {
		const cut = truncateUrl("https://eps.eko.in/?a=1&b=22222", 26);
		expect(cut).toBe("https://eps.eko.in/?a=1&b…");
		expect(cut).toHaveLength(26);
	});

	it("never leaves half a percent-escape before the mark", () => {
		// Cut points land after "%" and after "%2".
		expect(truncateUrl("https://e.in/?q=a%20b", 19)).toBe("https://e.in/?q=a…");
		expect(truncateUrl("https://e.in/?q=a%20b", 20)).toBe("https://e.in/?q=a…");
	});
});

describe("attributionFromUrl, long URLs", () => {
	it("trims First_Visited_URL but derives every param from the full URL", () => {
		const url = `https://eps.eko.in/aeps/?gclid=G1&pad=${"x".repeat(4000)}&utm_campaign=late`;
		const fields = attributionFromUrl(url);
		expect(fields.First_Visited_URL).toHaveLength(3000);
		expect(fields.First_Visited_URL.endsWith("…")).toBe(true);
		expect(
			fields.First_Visited_URL.startsWith(
				"https://eps.eko.in/aeps/?gclid=G1&pad=",
			),
		).toBe(true);
		// Past the cut, still derived.
		expect(fields.utm_campaign).toBe("late");
		expect(fields.Ad_ID).toBe("G1");
	});
});
