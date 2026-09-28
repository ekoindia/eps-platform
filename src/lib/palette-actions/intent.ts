import { earningsProductOf, earningsSlotsOf } from "./earnings";
import { normalizeAmounts } from "./normalize";
import type { ActionIntent, DetectedIntent } from "./types";

/**
 * Words that phrase a request rather than name its subject. Stripped to leave
 * what the visitor is asking about ("is there an api to verify pan" → "verify
 * pan"), which is what MiniSearch resolves.
 */
const FILLER = new Set([
	"a",
	"an",
	"the",
	"is",
	"are",
	"there",
	"any",
	"do",
	"does",
	"you",
	"your",
	"have",
	"has",
	"i",
	"we",
	"me",
	"my",
	"our",
	"want",
	"need",
	"can",
	"could",
	"how",
	"which",
	"what",
	"where",
	"to",
	"for",
	"of",
	"please",
	"api",
	"apis",
	"endpoint",
	"endpoints",
	"eko",
	"eps",
	"with",
	"using",
	"via",
	"give",
	"show",
	"find",
	"some",
	// how_to_build phrasing
	"integrate",
	"integration",
	"build",
	"implement",
	"flow",
	"workflow",
	"recipe",
	"steps",
	"step",
	"walkthrough",
	"guide",
]);

/**
 * Strips request phrasing, keeping the words that name the subject.
 * @param query - Normalised query.
 * @returns Space-joined subject words; empty when only phrasing was typed.
 */
export function subjectOf(query: string): string {
	return query
		.toLowerCase()
		.replace(/[?!.,]/g, " ")
		.split(/\s+/)
		.filter((word) => word && !FILLER.has(word))
		.join(" ");
}

/** One intent rule: when `match` fires, the intent applies. */
interface Rule {
	intent: ActionIntent;
	match: RegExp;
}

/**
 * Ordered rules — first match wins, so a specific intent must come before a
 * general one. `find_api` is the catch-all for "api/endpoint" phrasing and
 * verb-led lookups; the other intents are added ahead of it.
 * ponytail: regex rules, not a classifier. They are the zero-MB comparator a
 * model router must beat (docs/palette-router-roadmap.md, Phase 1c).
 */
const RULES: readonly Rule[] = [
	{
		intent: "estimate_earnings",
		match:
			/\b(?:earn\w*|commissions?|income|profits?|margins?|payouts?|take[\s-]?home)\b|\bhow much\b.*\b(?:make|get)\b/i,
	},
	{
		// Account onboarding, not KYC *APIs*: bare "kyc" is left to find_api.
		intent: "get_started",
		match:
			/\b(?:get(?:ting)?\s+started|go(?:ing)?\s+live|onboard\w*|sign\s?up|register|create\s+(?:an?\s+)?account|next\s+steps?|api\s+keys?|(?:production|prod|live|uat)\s+(?:credentials|keys|access)|credentials|(?:activation|integration)\s+fee)\b/i,
	},
	{
		intent: "how_to_build",
		match:
			/\bhow\s+(?:do|does|can|to|would|should)\b|\b(?:integrat\w*|build|implement|flow|workflow|recipe|steps?|walkthrough)\b/i,
	},
	{
		intent: "find_api",
		match:
			/\b(apis?|endpoints?)\b|^\s*(verify|validate|check|fetch|look\s?up)\b/i,
	},
];

/**
 * Typed values an intent reads from the query. Only `estimate_earnings` has
 * slots today: the calculator product plus count/amount, when stated.
 */
function slotsFor(
	intent: ActionIntent,
	normalised: string,
	raw: string,
): DetectedIntent["slots"] {
	if (intent !== "estimate_earnings") return {};
	const product = earningsProductOf(normalised);
	return {
		...(product ? { product } : {}),
		...earningsSlotsOf(normalised, raw),
	};
}

/**
 * Reads an action intent from a palette query.
 * @param query - The raw query.
 * @returns The first matching intent with its subject and slots, or null when
 *   the query reads as plain search (the palette then shows results only).
 */
export function detectIntent(query: string): DetectedIntent | null {
	const normalised = normalizeAmounts(query.trim());
	if (!normalised) return null;
	const rule = RULES.find((r) => r.match.test(normalised));
	if (!rule) return null;
	const subject = subjectOf(normalised);
	if (!subject) return null;
	return {
		intent: rule.intent,
		subject,
		slots: slotsFor(rule.intent, normalised, query),
	};
}
