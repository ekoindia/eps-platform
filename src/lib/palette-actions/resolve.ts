import { search } from "@/lib/search-engine";
import { SEARCH_INDEX } from "@/lib/search-index";
import { RECIPES } from "@/lib/data/api-recipes";
import { resolveEstimateEarnings } from "./earnings";
import { type PaletteSession, resolveGetStarted } from "./get-started";
import { detectIntent } from "./intent";
import type { ActionCard, CardLink, DetectedIntent } from "./types";

/** The palette's MiniSearch engine, as `search()` takes it. */
type Engine = Parameters<typeof search>[0];

/** A runner-up within this share of the top score counts as a close call. */
const CLOSE_SCORE = 0.85;
/** Runners-up listed on a card at most. */
const MAX_ALTERNATIVES = 2;

/** Search categories a `find_api` card may point at: product pages and REST operations. */
const API_CATEGORIES = new Set(["api", "endpoint"]);

/**
 * Best-hit categories that mean the visitor wants a page, not an API: "api
 * pricing" → Pricing, "how does authentication work" → the auth guide. The
 * plain results already lead with it, so no card.
 */
const NOT_AN_API = new Set(["page", "guide", "faq", "sdk"]);

/**
 * `find_api`: the best product page or REST operation for the subject. Uses
 * the palette's own ranking (all scopes, products ahead of endpoints on equal
 * relevance), so "dmt api" lands on the DMT product and "fetch bill" on the
 * Fetch Bill endpoint. Endpoints get a Try-it link.
 * @param engine - The palette's search engine.
 * @param detected - The detected intent.
 * @returns A card, or null when no product or endpoint matches every subject
 *   word, or when the best match overall is a docs page rather than an API.
 */
export function resolveFindApi(
	engine: Engine,
	detected: DetectedIntent,
): ActionCard | null {
	const hits = search(engine, detected.subject, "all", { strict: true });
	if (!hits[0] || NOT_AN_API.has(hits[0].item.category)) return null;
	const [top, ...rest] = hits.filter((r) =>
		API_CATEGORIES.has(r.item.category),
	);
	if (!top) return null;
	const { item } = top;
	const isEndpoint = item.category === "endpoint";
	const alternatives: CardLink[] = rest
		.filter((r) => r.score >= top.score * CLOSE_SCORE)
		.slice(0, MAX_ALTERNATIVES)
		.map((r) => ({ label: r.item.label, href: r.item.href }));
	return {
		intent: "find_api",
		id: `action:find_api:${item.slug ?? item.id}`,
		title: item.label,
		detail: isEndpoint ? item.path : item.sublabel,
		badge: isEndpoint ? item.method : "Product",
		primary: {
			label: isEndpoint ? "Open API docs" : "Open product",
			href: item.href,
		},
		// `?try=1` opens the docs page's Try-it dialog on load (useTryIt).
		secondary:
			isEndpoint && item.path
				? [{ label: "Try it", href: `${item.href}?try=1` }]
				: [],
		alternatives,
	};
}

const RECIPE_BY_SLUG = new Map(RECIPES.map((r) => [r.slug, r]));
const ITEM_BY_ID = new Map(SEARCH_INDEX.map((item) => [item.id, item]));

/**
 * `how_to_build`: the best recipe (multi-step integration flow) for the
 * subject, with a link straight to its first step.
 * @param engine - The palette's search engine.
 * @param detected - The detected intent.
 * @returns A card, or null when no recipe matches.
 */
export function resolveHowToBuild(
	engine: Engine,
	detected: DetectedIntent,
): ActionCard | null {
	const [top, ...rest] = search(engine, detected.subject, "recipe", {
		strict: true,
	});
	const recipe = top && RECIPE_BY_SLUG.get(top.item.slug ?? "");
	if (!recipe) return null;
	const firstStep = ITEM_BY_ID.get(`endpoint:${recipe.steps[0]?.specSlug}`);
	return {
		intent: "how_to_build",
		id: `action:how_to_build:${recipe.slug}`,
		title: recipe.name,
		detail: `${recipe.steps.length} steps · ${recipe.summary}`,
		badge: "Recipe",
		primary: { label: "Open recipe", href: top.item.href },
		secondary: firstStep
			? [{ label: `Step 1: ${firstStep.label}`, href: firstStep.href }]
			: [],
		alternatives: rest
			.filter((r) => r.score >= top.score * CLOSE_SCORE)
			.slice(0, MAX_ALTERNATIVES)
			.map((r) => ({ label: r.item.label, href: r.item.href })),
	};
}

/**
 * Turns a palette query into an action card, or null for plain search.
 * @param engine - The palette's search engine.
 * @param query - The raw query.
 * @param session - Who is asking, for `get_started`; a visitor when omitted.
 */
export function resolveAction(
	engine: Engine,
	query: string,
	session: PaletteSession = { kind: "anon" },
): ActionCard | null {
	const detected = detectIntent(query);
	if (!detected) return null;
	switch (detected.intent) {
		case "find_api":
			return resolveFindApi(engine, detected);
		case "get_started":
			return resolveGetStarted(session);
		case "estimate_earnings":
			return resolveEstimateEarnings(detected);
		case "how_to_build":
			// "how do i verify a bank account" has no recipe but names an API.
			return (
				resolveHowToBuild(engine, detected) ??
				resolveFindApi(engine, { ...detected, intent: "find_api" })
			);
		default:
			return null;
	}
}
