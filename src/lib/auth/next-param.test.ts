import { describe, expect, it } from "vitest";
import { readNextParam } from "./next-param";

describe("readNextParam", () => {
	it("accepts a rooted in-app path, query and hash included", () => {
		expect(readNextParam("?next=/console/credentials")).toBe(
			"/console/credentials",
		);
		expect(readNextParam("next=/console/transactions?tab=failed#top")).toBe(
			"/console/transactions?tab=failed#top",
		);
		expect(readNextParam("?a=1&next=%2Fconsole%2Fdocuments")).toBe(
			"/console/documents",
		);
	});

	it("rejects anything that could leave the site", () => {
		// "//" and "/\" are both protocol-relative to a browser.
		for (const raw of [
			"//evil.com",
			"/\\evil.com",
			"https://evil.com",
			"javascript:alert(1)",
			"console/credentials",
		]) {
			expect(readNextParam(`?next=${encodeURIComponent(raw)}`)).toBeNull();
		}
	});

	it("returns null when the param is missing or empty", () => {
		expect(readNextParam("")).toBeNull();
		expect(readNextParam("?utm_source=ads")).toBeNull();
		expect(readNextParam("?next=")).toBeNull();
	});
});
