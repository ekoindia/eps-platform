import { describe, expect, it } from "vitest";
import {
	BUSINESS_FIELDS,
	INDIAN_STATES,
	validateField,
} from "./businessFields";

/** Looks a field up by name, failing loudly if the spec ever drops it. */
const field = (name: string) => {
	const found = BUSINESS_FIELDS.find((f) => f.name === name);
	if (!found) throw new Error(`no such field: ${name}`);
	return found;
};

describe("INDIAN_STATES", () => {
	it("carries upstream's 36 values verbatim", () => {
		expect(INDIAN_STATES).toHaveLength(36);
		// These exact strings are what interaction 522 matches on. If someone
		// "fixes" the spelling, the submit breaks — so pin them.
		expect(INDIAN_STATES).toContain("Puducherry");
		expect(INDIAN_STATES).toContain("Andhra Pradesh");
		expect(INDIAN_STATES).toContain("Delhi");
		expect(INDIAN_STATES).not.toContain("Ladakh");
	});
});

describe("validateField", () => {
	it("requires a company name of at least 2 characters", () => {
		expect(validateField(field("name"), "")).toMatch(/required/i);
		expect(validateField(field("name"), "A")).toBeTruthy();
		expect(validateField(field("name"), "Acme Retail")).toBeNull();
	});

	it("rejects a company name with disallowed punctuation", () => {
		expect(validateField(field("name"), "Acme@Retail")).toBeTruthy();
	});

	it("requires a well-formed email address", () => {
		expect(validateField(field("email"), "")).toMatch(/required/i);
		expect(validateField(field("email"), "asha@acme.in")).toBeNull();
		expect(validateField(field("email"), "asha@acme")).toBeTruthy();
		expect(validateField(field("email"), "not-an-email")).toBeTruthy();
	});

	it("offers the five upstream company types with their exact codes", () => {
		const companyType = field("company_type");
		expect(companyType.options?.map((o) => o.value)).toEqual([
			"1",
			"4",
			"2",
			"3",
			"5",
		]);
		// LLP is 4, not 2 — the codes are not sequential by label.
		expect(companyType.options?.find((o) => o.label === "LLP")?.value).toBe(
			"4",
		);
	});

	it("requires a 6-digit pincode", () => {
		expect(
			validateField(field("current_address_pincode"), "560038"),
		).toBeNull();
		expect(
			validateField(field("current_address_pincode"), "56003"),
		).toBeTruthy();
		expect(
			validateField(field("current_address_pincode"), "5600ab"),
		).toBeTruthy();
	});

	it("requires an address line of at least 10 characters", () => {
		expect(
			validateField(field("current_address_line1"), "12 MG Rd"),
		).toBeTruthy();
		expect(
			validateField(field("current_address_line1"), "12 MG Road, Indiranagar"),
		).toBeNull();
	});

	it("accepts a signatory name with spaces and initials", () => {
		expect(
			validateField(field("authorized_signatory_name"), "Asha Rao"),
		).toBeNull();
		expect(
			validateField(field("authorized_signatory_name"), "A. K. Rao"),
		).toBeNull();
		expect(
			validateField(field("authorized_signatory_name"), "Asha9"),
		).toBeTruthy();
	});

	it("accepts a city of letters and spaces only", () => {
		expect(
			validateField(field("current_address_district"), "Bengaluru"),
		).toBeNull();
		expect(
			validateField(field("current_address_district"), "Bengaluru1"),
		).toBeTruthy();
	});
});
