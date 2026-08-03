import { describe, expect, it } from "vitest";

import { buildEngine, parseQuery, search } from "@/lib/search-engine";
import { SEARCH_INDEX, searchItemId } from "@/lib/search-index";

/**
 * Ranking behaviour for the ⌘K palette. Complements search-index.test.ts, which
 * guards the *contents* of the index; this file guards how they are scored.
 *
 * Several cases here are regressions for bugs that were real and silent — see
 * the comments on each. Expected ids come from actual engine output, not from
 * guesses about what the corpus contains.
 */

const engine = buildEngine();

const ids = (query: string, scope = "all" as const, n = 5): string[] =>
	search(engine, query, scope)
		.slice(0, n)
		.map((r) => r.item.id);

const top = (query: string): string | undefined => ids(query, "all", 1)[0];

describe("multi-word queries", () => {
	// The headline defect of the old scorer: it required the whole query to
	// appear as one contiguous substring, so every multi-word query returned 0.
	it("finds the PAN product for a three-word query", () => {
		expect(top("pan verification api")).toBe("api:pan-verification-api");
	});

	it("answers a natural-language question by dropping stopwords", () => {
		// "how", "do", "i", "a" match no document. Without stopword removal,
		// combineWith:"AND" makes this query unanswerable.
		expect(top("how do i verify a bank account")).toBe(
			"endpoint:bank-account-verification",
		);
	});

	it("requires all meaningful terms (AND, not OR)", () => {
		// "aeps" alone matches 27 docs; adding a term that co-occurs with none
		// of them must narrow, never widen.
		expect(search(engine, "aeps", "all").length).toBeGreaterThan(
			search(engine, "aeps grievance", "all").length,
		);
	});
});

describe("synonyms and misspellings", () => {
	it("treats aadhar and aadhaar as the same term", () => {
		expect(ids("aadhar", "all", 5)).toEqual(ids("aadhaar", "all", 5));
	});

	it("maps multi-word phrases the tokenizer would otherwise split", () => {
		// PHRASE_ALIASES runs before tokenization; TOKEN_ALIASES cannot see these.
		expect(top("money transfer")).toBe("api:dmt-api");
		expect(top("bill payment")).toBe("api:bbps-api");
		expect(top("micro atm")).toBe("api:aeps-api");
	});

	// Regression: aliasing a word that EXISTS in the corpus ("remittance" → "dmt")
	// strips its surface form from the index, so fuzzy can no longer bridge a
	// typo to it. Alias only spellings the corpus never uses.
	it("still corrects a typo on a word the corpus actually contains", () => {
		expect(search(engine, "remitance", "all").length).toBeGreaterThan(0);
		expect(top("remitance")).toBe(top("remittance"));
	});

	// Regression: every alias target must be a real token. "cibil" → "creditscore"
	// pointed at a token present nowhere, so it returned 0 results by construction.
	it("only aliases onto tokens that exist in the index", () => {
		const corpus = SEARCH_INDEX.map(
			(i) =>
				`${i.label} ${i.sublabel ?? ""} ${i.slug ?? ""} ${i.keywords.join(" ")}`,
		)
			.join(" ")
			.toLowerCase();
		for (const target of ["aadhaar", "pan", "aeps", "bbps", "kyc", "gst"]) {
			expect(corpus, `alias target "${target}" missing from corpus`).toContain(
				target,
			);
		}
	});
});

describe("type weighting", () => {
	// Regression: boostDocument receives STORED fields, not the source document.
	// With storeFields:["id"] the typeWeight lookup was undefined and every
	// multiplier silently collapsed to 1.0 — no error, just dead weighting.
	it("surfaces a product above its own endpoints on its acronym", () => {
		for (const q of ["bbps", "aeps", "dmt", "gst", "upi"]) {
			const first = search(engine, q, "all")[0];
			expect(first?.item.category, `query "${q}" → ${first?.item.id}`).toBe(
				"api",
			);
		}
	});

	it("keeps FAQs below richer content", () => {
		const results = search(engine, "pricing", "all");
		const firstFaq = results.findIndex((r) => r.item.category === "faq");
		const firstNonFaq = results.findIndex((r) => r.item.category !== "faq");
		if (firstFaq >= 0 && firstNonFaq >= 0) {
			expect(firstNonFaq).toBeLessThan(firstFaq);
		}
	});
});

describe("precision", () => {
	// The regression that motivated the old substring gate: cmdk's subsequence
	// matching let "pricing" hit half the index through long SEO keyword strings.
	it("does not match half the index on a generic term", () => {
		expect(search(engine, "pricing", "all").length).toBeLessThan(20);
	});

	it("returns nothing for gibberish", () => {
		expect(search(engine, "zzzqqxx", "all")).toHaveLength(0);
	});

	it("does not fuzzy-match short acronyms into unrelated terms", () => {
		// At 3 chars an edit distance of 1 would make "pan" match "pin"/"can"/"ban".
		for (const r of search(engine, "pan", "all")) {
			const haystack =
				`${r.item.label} ${r.item.sublabel ?? ""} ${r.item.slug ?? ""} ${r.item.keywords.join(" ")}`.toLowerCase();
			expect(haystack, r.item.id).toContain("pan");
		}
	});

	it("returns an empty list for a blank query", () => {
		expect(search(engine, "   ", "all")).toHaveLength(0);
	});
});

describe("scope", () => {
	it("narrows without reordering", () => {
		const globalOrder = search(engine, "bank", "all")
			.filter((r) => r.item.category === "endpoint")
			.map((r) => r.item.id);
		expect(search(engine, "bank", "endpoint").map((r) => r.item.id)).toEqual(
			globalOrder,
		);
	});

	it("returns only the requested category", () => {
		for (const r of search(engine, "verification", "api")) {
			expect(r.item.category).toBe("api");
		}
	});
});

describe("parseQuery", () => {
	it("consumes a leading scope token", () => {
		expect(parseQuery("e: upi")).toEqual({ scope: "endpoint", query: "upi" });
		expect(parseQuery("guide:auth")).toEqual({
			scope: "guide",
			query: "auth",
		});
	});

	it("leaves an ordinary query alone", () => {
		expect(parseQuery("pan card")).toEqual({ scope: null, query: "pan card" });
	});
});

describe("body index", () => {
	// search-body.json is keyed by searchItemId(). If the plugin and the runtime
	// index ever disagreed, every body would silently attach to nothing — the
	// engine would still work, just with no body matches at all.
	it("keys bodies by the same id the index generates", () => {
		for (const item of SEARCH_INDEX) {
			if (item.category === "page" || item.category === "faq") continue;
			expect(searchItemId(item.category, item.slug as string)).toBe(item.id);
		}
	});

	it("makes prose searchable that labels and keywords do not contain", () => {
		const target = SEARCH_INDEX.find((i) => i.category === "endpoint")!;
		const withBodies = buildEngine({
			[target.id]: "supercalifragilistic reconciliation ledger",
		});
		expect(search(engine, "supercalifragilistic", "all")).toHaveLength(0);
		expect(search(withBodies, "supercalifragilistic", "all")[0]?.item.id).toBe(
			target.id,
		);
	});

	it("ranks a body-only match below a label match for the same term", () => {
		const [labelled, bodied] = SEARCH_INDEX.filter(
			(i) => i.category === "endpoint",
		);
		const withBodies = buildEngine({ [bodied.id]: `prose ${labelled.label}` });
		const results = search(withBodies, labelled.label, "all");
		const labelRank = results.findIndex((r) => r.item.id === labelled.id);
		const bodyRank = results.findIndex((r) => r.item.id === bodied.id);
		if (bodyRank >= 0) expect(labelRank).toBeLessThan(bodyRank);
	});

	it("ignores body entries for ids that are not in the index", () => {
		expect(() =>
			buildEngine({ "endpoint:does-not-exist": "orphan" }),
		).not.toThrow();
	});
});

describe("highlight terms", () => {
	it("reports the matched terms for every result", () => {
		for (const r of search(engine, "bank", "all")) {
			expect(r.terms.length, r.item.id).toBeGreaterThan(0);
		}
	});

	it("reports the canonical term when the user typed an alias", () => {
		// User types "aadhar"; the term that actually matched is "aadhaar", which
		// is what should be bolded in the rendered row.
		const [first] = search(engine, "aadhar", "all");
		expect(first.terms).toContain("aadhaar");
	});
});
