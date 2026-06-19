/**
 * Builds the canonical agent bundle (`/agent/eps.json`) + split slices from the
 * spec layer and `api-recipes.ts`.
 *
 * Pure + deterministic (no I/O, no Date) like `build-openapi.ts`, so it
 * unit-tests cleanly and produces byte-stable output for a given spec set.
 */
import { API_DEFAULT_VERSION, SITE_URL } from "@/lib/config/site";
import {
	API_AUTH_DOCS_URL,
	API_AUTH_INFO,
	API_ENVIRONMENTS,
} from "@/lib/data/api-auth";
import {
	ALL_ERROR_CODES,
	API_ERROR_CODES_DOCS_URL,
} from "@/lib/data/api-error-codes";
import { ACTIVE_PRODUCTS_MAP } from "@/lib/data/api-products";
import { RECIPES, assertRecipeSlugs } from "@/lib/data/api-recipes";
import type { ApiSpec } from "@/lib/data/api-specs-common";
import {
	buildSampleRequest,
	resolveHeaders,
	resolveRequestParams,
	resolveResponseFields,
} from "@/lib/data/api-specs-common";
import type {
	AgentApiDetail,
	AgentApiIndexEntry,
	AgentBundle,
	AgentEnvironment,
	AgentIndex,
	AgentTopicId,
	AgentTopics,
} from "@/lib/agent/agent-bundle-types";

const BACKEND_ONLY_WARNING =
	"Backend-only. The access_key is a server-side secret used to compute the " +
	"per-request secret-key (HMAC-SHA256). Never expose access_key or compute " +
	"secret-key in a browser/frontend.";

const ENVIRONMENTS: AgentEnvironment[] = [
	{ id: "sandbox", ...API_ENVIRONMENTS.sandbox },
	{ id: "production", ...API_ENVIRONMENTS.production },
];

/** Deterministic 32-bit FNV-1a hash (hex) — no crypto/Date dependency. */
const fnv1aHex = (input: string): string => {
	let h = 0x811c9dc5;
	for (let i = 0; i < input.length; i++) {
		h ^= input.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return (h >>> 0).toString(16).padStart(8, "0");
};

const productNameFor = (spec: ApiSpec): string =>
	ACTIVE_PRODUCTS_MAP[spec.productId]?.name ?? spec.productId;

const indexEntry = (spec: ApiSpec): AgentApiIndexEntry => ({
	slug: spec.slug,
	productId: spec.productId,
	productName: productNameFor(spec),
	name: spec.name,
	method: spec.method,
	path: spec.path,
	summary: spec.summary,
	category: spec.category,
	relevance: spec.relevance,
});

const apiDetail = (spec: ApiSpec): AgentApiDetail => ({
	...indexEntry(spec),
	description: spec.description,
	bestFor: spec.bestFor,
	docsUrl: spec.docsUrl,
	financial: spec.financial,
	headers: resolveHeaders(),
	requestParams: resolveRequestParams(spec),
	sampleRequest: buildSampleRequest(spec),
	responseFields: resolveResponseFields(spec),
	sampleSuccessResponse: spec.sampleSuccessResponse,
	errorScenarios: spec.errorScenarios ?? [],
});

const buildTopics = (): AgentTopics => ({
	auth: {
		id: "auth",
		backendOnly: true,
		warning: BACKEND_ONLY_WARNING,
		docsUrl: API_AUTH_DOCS_URL,
		keys: API_AUTH_INFO.keys,
		headers: resolveHeaders(),
		secretKeyGeneration: [...API_AUTH_INFO.secretKeyGeneration],
	},
	errors: {
		id: "errors",
		docsUrl: API_ERROR_CODES_DOCS_URL,
		codes: ALL_ERROR_CODES,
	},
	pricing: {
		id: "pricing",
		summary:
			"Per-transaction rates for all products. See the rate card and the " +
			"offline calculator for exact slabs.",
		links: [
			{ label: "Rate card (markdown)", url: `${SITE_URL}/pricing.md` },
			{
				label: "Offline calculator (xlsx)",
				url: `${SITE_URL}/eps-pricing-calculator.xlsx`,
			},
		],
	},
	environments: { id: "environments", environments: ENVIRONMENTS },
});

/**
 * Build the full agent bundle. Callers should pass the documented set
 * (`getDocumentedSpecs()`).
 */
export const buildAgentBundle = (specs: ApiSpec[]): AgentBundle => {
	assertRecipeSlugs(RECIPES, new Set(specs.map((s) => s.slug)));

	const topics = buildTopics();
	const apis = specs.map(apiDetail);
	const recipes = RECIPES;

	const hashInput = JSON.stringify({ topics, apis, recipes });
	const meta = {
		org: "ekoindia",
		apiVersion: API_DEFAULT_VERSION,
		bundleVersion: fnv1aHex(hashInput),
		environments: ENVIRONMENTS,
	};

	return { meta, topics, apis, recipes };
};

/** Compact index slice — no full bodies. */
export const buildIndex = (bundle: AgentBundle): AgentIndex => ({
	meta: bundle.meta,
	apis: bundle.apis.map(
		({
			slug,
			productId,
			productName,
			name,
			method,
			path,
			summary,
			category,
			relevance,
		}) => ({
			slug,
			productId,
			productName,
			name,
			method,
			path,
			summary,
			category,
			relevance,
		}),
	),
	topics: Object.keys(bundle.topics) as AgentTopicId[],
	recipes: bundle.recipes.map((r) => ({
		id: r.id,
		name: r.name,
		summary: r.summary,
	})),
});

/** One endpoint's full detail, or undefined for an unknown slug. */
export const buildApi = (
	bundle: AgentBundle,
	slug: string,
): AgentApiDetail | undefined => bundle.apis.find((a) => a.slug === slug);

/** One topic by id. */
export const buildTopic = <K extends AgentTopicId>(
	bundle: AgentBundle,
	topic: K,
): AgentTopics[K] => bundle.topics[topic];
