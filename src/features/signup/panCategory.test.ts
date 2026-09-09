import { describe, expect, it } from "vitest";
import { COMPANY_TYPES } from "./businessFields";
import {
	companyTypeForPan,
	normalizePan,
	isPersonalPan,
	orderCompanyTypes,
	PAN_CATEGORY_LABELS,
	panCategory,
	panCategoryPhrase,
} from "./panCategory";

/** Builds a well-formed PAN carrying `letter` in the 4th position. */
const panWith = (letter: string) => `ABC${letter}E1234F`;

describe("normalizePan", () => {
	it("strips whitespace and punctuation, and uppercases", () => {
		expect(normalizePan("abcde 1234 f")).toBe("ABCDE1234F");
		expect(normalizePan("ABCDE-1234-F")).toBe("ABCDE1234F");
		expect(normalizePan("  abcpe1234f  ")).toBe("ABCPE1234F");
		expect(normalizePan("ABCDE/1234.F")).toBe("ABCDE1234F");
	});

	it("keeps the whole PAN when the junk pushes it past 10 characters", () => {
		// The regression this exists for: `maxLength` truncated a spaced paste to
		// 10 DIRTY characters, losing the final letter. Stripping must come first.
		expect(normalizePan("ABCDE 1234 F")).toBe("ABCDE1234F");
		expect(normalizePan("A B C D E 1 2 3 4 F")).toBe("ABCDE1234F");
	});

	it("caps length after stripping, not before", () => {
		expect(normalizePan("ABCDE1234FXYZ")).toBe("ABCDE1234F");
		expect(normalizePan("ABCDE1234F  extra")).toBe("ABCDE1234F");
	});

	it("handles empty and all-junk input", () => {
		expect(normalizePan("")).toBe("");
		expect(normalizePan("   ")).toBe("");
		expect(normalizePan("---")).toBe("");
	});

	it("leaves an already-clean PAN untouched", () => {
		expect(normalizePan("ABCPE1234F")).toBe("ABCPE1234F");
	});
});

describe("panCategory", () => {
	it("reads the holder-type letter out of a complete PAN", () => {
		for (const letter of Object.keys(PAN_CATEGORY_LABELS)) {
			expect(panCategory(panWith(letter))).toBe(letter);
		}
	});

	it("returns null while the PAN is incomplete or malformed", () => {
		expect(panCategory("")).toBeNull();
		expect(panCategory("ABCP")).toBeNull();
		expect(panCategory("ABCPE1234")).toBeNull();
		expect(panCategory("abcpe1234f")).toBeNull(); // lowercase never reaches us
		expect(panCategory("ABCPE12345")).toBeNull(); // last char must be a letter
	});
});

describe("panCategoryPhrase", () => {
	it("names every real category", () => {
		for (const letter of Object.keys(PAN_CATEGORY_LABELS)) {
			expect(panCategoryPhrase(letter)).toBeTruthy();
		}
		expect(panCategoryPhrase("C")).toBe("a company PAN");
		expect(panCategoryPhrase("P")).toBe("an individual's PAN");
	});

	it("falls back without claiming a holder type for an unallocated letter", () => {
		// PAN_PATTERN accepts ANY letter in the 4th position, not just the ten the
		// department allocates — "ABCDE1234F" is format-valid with category "D".
		// Those must still read as success, just without inventing a holder type.
		expect(panCategory("ABCDE1234F")).toBe("D");
		expect(panCategoryPhrase("D")).toBe("a valid PAN");
		expect(panCategoryPhrase("Z")).toBe("a valid PAN");
		expect(panCategoryPhrase(null)).toBe("a valid PAN");
	});
});

describe("isPersonalPan", () => {
	it("is true only for category P", () => {
		expect(isPersonalPan(panWith("P"))).toBe(true);
		for (const letter of ["C", "H", "F", "A", "T", "B", "L", "J", "G"]) {
			expect(isPersonalPan(panWith(letter))).toBe(false);
		}
	});

	it("stays false while the PAN is still being typed", () => {
		expect(isPersonalPan("ABCP")).toBe(false);
	});
});

describe("companyTypeForPan", () => {
	it("preselects only where one option dominates its category", () => {
		expect(companyTypeForPan("C")).toBe("1"); // Private Limited
		expect(companyTypeForPan("F")).toBe("4"); // LLP
	});

	it("preselects nothing for an ambiguous or unmatched category", () => {
		// P is a genuine coin flip between Sole Proprietorship and Individual.
		expect(companyTypeForPan("P")).toBeNull();
		for (const letter of ["H", "A", "T", "B", "L", "J", "G", "Z"]) {
			expect(companyTypeForPan(letter)).toBeNull();
		}
		expect(companyTypeForPan(null)).toBeNull();
	});
});

describe("orderCompanyTypes", () => {
	const valuesFor = (category: string | null) =>
		orderCompanyTypes(category).map((t) => t.value);

	it("floats the candidates a category admits to the top", () => {
		expect(valuesFor("P").slice(0, 2)).toEqual(["3", "7"]); // Sole Prop, Individual
		expect(valuesFor("C").slice(0, 2)).toEqual(["1", "5"]); // Pvt Ltd, Public Ltd
		expect(valuesFor("F").slice(0, 2)).toEqual(["4", "2"]); // LLP, Partnership
	});

	it("leaves the default order alone for a category with no match", () => {
		const defaultOrder = COMPANY_TYPES.map((t) => t.value);
		for (const category of ["H", "A", "T", "B", "L", "J", "G", "Z", null]) {
			expect(valuesFor(category)).toEqual(defaultOrder);
		}
	});

	it("never adds, drops or duplicates an option", () => {
		// The ordering is a hint, not a filter: a partner whose PAN letter
		// disagrees with their legal type must still be able to pick it.
		const expected = [...COMPANY_TYPES].map((t) => t.value).sort();
		for (const category of ["P", "C", "F", "H", "Z", null]) {
			const values = valuesFor(category);
			expect(values).toHaveLength(COMPANY_TYPES.length);
			expect(new Set(values).size).toBe(values.length);
			expect([...values].sort()).toEqual(expected);
		}
	});

	it("puts every preselected value at the head of its own ordering", () => {
		// Guards the one way the two functions could silently disagree: a prefill
		// that is not the first thing the user sees in the list.
		for (const category of ["P", "C", "F", "H"]) {
			const prefill = companyTypeForPan(category);
			if (prefill) expect(valuesFor(category)[0]).toBe(prefill);
		}
	});

	it("only ever names values that exist in COMPANY_TYPES", () => {
		const known = new Set(COMPANY_TYPES.map((t) => t.value));
		for (const category of ["P", "C", "F"]) {
			const prefill = companyTypeForPan(category);
			if (prefill) expect(known.has(prefill)).toBe(true);
		}
	});
});
