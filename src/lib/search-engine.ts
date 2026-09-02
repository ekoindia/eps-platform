import MiniSearch, { type SearchResult } from "minisearch";

import {
	MAX_TYPE_WEIGHT,
	SEARCH_INDEX,
	type SearchCategory,
	type SearchItem,
} from "@/lib/search-index";

/**
 * Lexical search over SEARCH_INDEX, built on MiniSearch (BM25 + prefix + fuzzy).
 *
 * Lives outside CommandPalette.tsx so ranking is testable without a DOM — the
 * previous hand-rolled scorer sat inside the component and could not be
 * exercised headless.
 */

/** Scope tabs — narrow the result set by asset type. */
export type Scope = SearchCategory | "all";

/**
 * Single-token aliases → canonical token. Applied at BOTH index and query time,
 * so a document written "Aadhaar" and a query typed "aadhar" converge on the
 * same token without expanding either side.
 *
 * Expanding at index time (emitting canonical + every alias) was the obvious
 * alternative and is worse: a document that naturally contains several aliases
 * gets its term frequency inflated and outranks better matches.
 *
 * Two rules, both learned the hard way — see search-engine.test.ts:
 *
 * 1. Only alias spellings that are ABSENT from the corpus. Aliasing a word that
 *    documents actually contain (e.g. "remittance") strips the surface form out
 *    of the index, so fuzzy matching can no longer bridge a typo to it —
 *    "remitance" would find nothing. Absent misspellings have no such cost.
 * 2. The target must be a token that EXISTS. Mapping "cibil" onto a coined
 *    "creditscore" just guarantees zero results.
 *
 * MiniSearch tokenizes BEFORE calling processTerm, so only single tokens belong
 * here — multi-word forms go in PHRASE_ALIASES below.
 */
const TOKEN_ALIASES: Record<string, string> = {
	// Aadhaar misspellings (the correct spelling is what the corpus uses)
	aadhar: "aadhaar",
	adhaar: "aadhaar",
	adhar: "aadhaar",
	// PAN — colloquial and issuing-authority names
	pancard: "pan",
	nsdl: "pan",
	// AePS — "mATM" never appears in the corpus, "aeps" does
	matm: "aeps",
	// Bill payments
	billpay: "bbps",
	// KYC variants absent from the corpus ("ekyc" is present, so it is NOT aliased)
	okyc: "kyc",
	ckyc: "kyc",
	// GST
	gstn: "gst",
};

/**
 * Multi-word phrases → canonical token, applied to the raw query string before
 * MiniSearch tokenizes it. These cannot live in TOKEN_ALIASES because the
 * tokenizer would have already split them.
 */
const PHRASE_ALIASES: [RegExp, string][] = [
	[/\bmicro[\s-]?atm\b/g, "aeps"],
	[/\bmoney[\s-]?transfer\b/g, "dmt"],
	[/\bbill[\s-]?payment(s)?\b/g, "bbps"],
	[/\bpan[\s-]?card\b/g, "pan"],
	// "penny drop" is deliberately absent: both words exist in the corpus prose,
	// so once Phase B indexes body text the natural tokens match. Rewriting it to
	// a coined "pennydrop" token would guarantee zero results instead.
];

/**
 * English function words dropped from both index and query.
 *
 * Load-bearing: combineWith "AND" requires every query token to match, so
 * without this a natural question like "how do I verify a bank account"
 * returns nothing — not because the corpus lacks the answer, but because no
 * document contains the token "how".
 */
const STOPWORDS = new Set([
	"a",
	"an",
	"and",
	"are",
	"as",
	"at",
	"be",
	"by",
	"can",
	"do",
	"does",
	"for",
	"from",
	"how",
	"i",
	"if",
	"in",
	"is",
	"it",
	"me",
	"my",
	"of",
	"on",
	"or",
	"our",
	"that",
	"the",
	"to",
	"what",
	"when",
	"where",
	"which",
	"who",
	"why",
	"with",
	"you",
	"your",
]);

const norm = (term: string): string =>
	term.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Shared index/query term pipeline: normalise → drop stopwords → canonicalise.
 * Returning null tells MiniSearch to skip the token entirely.
 */
const processTerm = (term: string): string | null => {
	const n = norm(term);
	if (!n || STOPWORDS.has(n)) return null;
	return TOKEN_ALIASES[n] ?? n;
};

/** Applies PHRASE_ALIASES to a raw query before MiniSearch tokenizes it. */
const expandPhrases = (query: string): string =>
	PHRASE_ALIASES.reduce(
		(q, [pattern, canonical]) => q.replace(pattern, canonical),
		query.toLowerCase(),
	);

/**
 * Strength of the asset-type multiplier, which spans [1 .. 1 + TYPE_ALPHA].
 *
 * The old hand-rolled scorer used 0.5, which was too weak to deliver what
 * TYPE_WEIGHT promises ("higher = surfaced first on equal text relevance"):
 * the query "bbps" put api:bbps-api SEVENTH, behind six of its own endpoints,
 * because raw BM25 spread between sibling documents exceeded the 1.0–1.5 range.
 * At 1.5 a product outranks its own endpoints on comparable text relevance,
 * and FAQs (weight 0) still sink below everything else.
 */
const TYPE_ALPHA = 1.5;

/**
 * Fuzzy matching by term length. Short acronyms (pan, gst, upi, dmt) must match
 * exactly — at 3 characters an edit distance of 1 makes "pan" match "pin",
 * "can" and "ban", which is worse than no fuzziness at all.
 */
const fuzzyForTerm = (term: string): number | boolean =>
	term.length >= 5 ? 0.2 : term.length >= 4 ? 0.15 : false;

/** The document shape handed to MiniSearch — keywords flattened, body optional. */
interface IndexedDoc extends Omit<SearchItem, "keywords"> {
	keywords: string;
	body?: string;
}

const INDEX_FIELDS = ["label", "sublabel", "slug", "keywords"] as const;

/**
 * Builds the MiniSearch index. Pass `bodies` (id → prose, from search-body.json)
 * to additionally index long-form page text; omit it for the label-only index
 * that ships in the palette chunk.
 */
export const buildEngine = (
	bodies?: Record<string, string>,
): MiniSearch<IndexedDoc> => {
	const engine = new MiniSearch<IndexedDoc>({
		idField: "id",
		fields: bodies ? [...INDEX_FIELDS, "body"] : [...INDEX_FIELDS],
		// typeWeight must be stored: MiniSearch passes STORED fields to
		// boostDocument, not the original document. Omit it and the type
		// multiplier silently collapses to 1.0 for every result.
		storeFields: ["id", "typeWeight"],
		processTerm,
		searchOptions: {
			prefix: true,
			fuzzy: fuzzyForTerm,
			combineWith: "AND",
			processTerm,
			boost: {
				slug: 8,
				label: 3,
				keywords: 1.5,
				sublabel: 1,
				body: 0.4,
			},
			boostDocument: (_id, _term, stored) =>
				1 +
				TYPE_ALPHA * (((stored?.typeWeight as number) ?? 0) / MAX_TYPE_WEIGHT),
		},
	});

	engine.addAll(
		SEARCH_INDEX.map((item) => ({
			...item,
			keywords: item.keywords.join(" "),
			body: bodies?.[item.id],
		})),
	);
	return engine;
};

/**
 * Fraction of the best score a result must reach to survive the OR fallback.
 *
 * OR matches a document on any single term, so an unfiltered fallback returns
 * 30–100 items, almost all noise. Measured score curves drop off a cliff after
 * the genuine matches — at 0.2 the same queries return 1–9.
 */
const OR_SCORE_FLOOR = 0.2;

/**
 * Hard cap on rendered results.
 *
 * Indexing body prose widened recall a lot — "pricing" goes from 2 matches to
 * 102 once page text is searchable. The extra matches are real but nobody
 * scrolls a command palette that far (the list viewport shows ~9 rows), and
 * every one of them is a DOM node built on each keystroke.
 */
const MAX_RESULTS = 50;

export interface Ranked {
	item: SearchItem;
	score: number;
	/** Indexed terms that matched — drives highlighting. */
	terms: string[];
}

const ITEM_BY_ID = new Map(SEARCH_INDEX.map((item) => [item.id, item]));

/**
 * Runs a query and returns ranked items, optionally narrowed to one scope.
 *
 * Scope is applied after scoring rather than by pre-filtering the corpus: a
 * scoped search returns the same relative order those items had globally.
 */
export const search = (
	engine: MiniSearch<IndexedDoc>,
	query: string,
	scope: Scope = "all",
): Ranked[] => {
	const expanded = expandPhrases(query.trim());
	if (!expanded) return [];

	let hits = engine.search(expanded);

	// Descriptive queries phrased as a sentence — "confirm a company actually
	// exists" — routinely contain a word no document uses, and under AND a
	// single such word zeroes the whole query. Retry with OR, keeping only
	// results close to the best score so the long noise tail is discarded.
	//
	// Only on a total miss: a query that already returned something precise must
	// not be diluted by loosely-related OR matches.
	if (hits.length === 0) {
		const loose = engine.search(expanded, { combineWith: "OR" });
		const floor = (loose[0]?.score ?? 0) * OR_SCORE_FLOOR;
		hits = loose.filter((r) => r.score >= floor);
	}

	const ranked = hits.reduce<Ranked[]>((acc, result: SearchResult) => {
		const item = ITEM_BY_ID.get(result.id as string);
		if (!item) return acc;
		if (scope !== "all" && item.category !== scope) return acc;
		acc.push({ item, score: result.score, terms: Object.keys(result.match) });
		return acc;
	}, []);

	// Capped after scope filtering, so narrowing to a scope never returns fewer
	// items than it should just because the global head filled the cap.
	return ranked.length > MAX_RESULTS ? ranked.slice(0, MAX_RESULTS) : ranked;
};

/**
 * Leading prefix tokens that jump straight to a scope (e.g. `e: upi`). Tokens
 * are consumed from the input the moment they're typed; the active tab reflects
 * the chosen scope. Avoids the ambiguous `p:`.
 */
const TOKEN_SCOPE: Record<string, Scope> = {
	"all:": "all",
	"api:": "api",
	"prod:": "api",
	"product:": "api",
	"e:": "endpoint",
	"ep:": "endpoint",
	"endpoint:": "endpoint",
	"g:": "guide",
	"guide:": "guide",
	"sdk:": "sdk",
	"sol:": "solution",
	"solution:": "solution",
	"ind:": "industry",
	"industry:": "industry",
	"page:": "page",
	"faq:": "faq",
};

/** Splits a leading prefix token off the raw input → { scope, query }. */
export const parseQuery = (
	raw: string,
): { scope: Scope | null; query: string } => {
	const lower = raw.toLowerCase();
	for (const [token, scope] of Object.entries(TOKEN_SCOPE)) {
		if (lower.startsWith(token)) {
			return { scope, query: raw.slice(token.length).replace(/^\s+/, "") };
		}
	}
	return { scope: null, query: raw };
};
