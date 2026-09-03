/**
 * Builds the canonical agent bundle (`/agent/eps.json`) + split slices from the
 * spec layer and `api-recipes.ts`.
 *
 * Pure + deterministic (no I/O, no Date) like `build-openapi.ts`, so it
 * unit-tests cleanly and produces byte-stable output for a given spec set.
 */
import type {
	AgentApiDetail,
	AgentApiIndexEntry,
	AgentBundle,
	AgentEnvironment,
	AgentIndex,
	AgentSdk,
	AgentTopicId,
	AgentTopics,
} from "@/lib/agent/agent-bundle-types";
import { API_DEFAULT_VERSION, SITE_URL } from "@/lib/config/site";
import { API_AUTH_INFO, API_ENVIRONMENTS } from "@/lib/data/api-auth";
import { ALL_ERROR_CODES } from "@/lib/data/api-error-codes";
import { ACTIVE_PRODUCTS_MAP } from "@/lib/data/api-products";
import { RECIPES, assertRecipeSlugs } from "@/lib/data/api-recipes";
import type { ApiSpec } from "@/lib/data/api-specs-common";
import {
	assertResponseTypeSlugs,
	buildSampleRequest,
	categoryForSpec,
	resolveHeaders,
	resolveRequestParams,
	resolveResponseFields,
	assertParamFormats,
} from "@/lib/data/api-specs-common";
import { API_SPECS_MAP } from "@/lib/data/api-specs";
import { docHrefForSlug, docsHref } from "@/lib/data/docs-registry";
import { SDK_GUIDES, sdkGuideHref } from "@/lib/data/sdk-guides";
import { SDK_INSTALL, sdkSampleFor } from "@/lib/docs/code-samples";
import { resolveShortDescription } from "@/lib/data/endpoint-descriptions";

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
	category: categoryForSpec(spec),
	relevance: spec.relevance,
});

const apiDetail = (spec: ApiSpec): AgentApiDetail => ({
	...indexEntry(spec),
	description: resolveShortDescription(spec),
	bestFor: spec.bestFor,
	docsUrl: `${SITE_URL}${docHrefForSlug(spec.slug) ?? docsHref()}`,
	financial: spec.financial,
	headers: resolveHeaders(spec),
	requestParams: resolveRequestParams(spec),
	sampleRequest: buildSampleRequest(spec),
	responseFields: resolveResponseFields(spec),
	sampleSuccessResponse: spec.sampleSuccessResponse,
	errorScenarios: spec.errorScenarios ?? [],
	responseTypes: spec.responseTypes ?? [],
});

const buildTopics = (): AgentTopics => ({
	auth: {
		id: "auth",
		backendOnly: true,
		warning: BACKEND_ONLY_WARNING,
		docsUrl: `${SITE_URL}${docsHref("how-auth-works")}`,
		keys: API_AUTH_INFO.keys,
		headers: resolveHeaders(),
		secretKeyGeneration: [...API_AUTH_INFO.secretKeyGeneration],
		testVector: { ...API_AUTH_INFO.testVector },
	},
	errors: {
		id: "errors",
		docsUrl: `${SITE_URL}${docsHref("error-codes")}`,
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
	"getting-started": {
		id: "getting-started",
		summary:
			"Start testing Eko verification APIs in ~10 minutes: sign up, verify " +
			"identity, load your wallet, and test live before integrating.",
		steps: [
			{
				title: "Sign up",
				detail: "Sign up with your mobile number (OTP verified).",
				url: `${SITE_URL}/console`,
			},
			{
				title: "Verify identity",
				detail: "Submit your PAN and address details.",
			},
			{
				title: "Test live",
				detail:
					"Load wallet funds; call the verification APIs live to evaluate before integrating.",
			},
			{
				title: "Integrate",
				detail: "Free AI plugins/tools + MCP & SDKs to integrate faster.",
				url: `${SITE_URL}/ai`,
			},
			{
				title: "Go live",
				detail:
					"Welcome email lists the KYC docs for production; reply with docs to get production keys.",
			},
		],
		links: [
			{ label: "Sign up", url: `${SITE_URL}/console` },
			{ label: "AI integration hub", url: `${SITE_URL}/ai` },
		],
	},
});

/** Project `SDK_GUIDES` into the bundle, joining the install coordinates and the
 * worked example that live in the docs layer. Same source as `/docs/sdk`. */
/** The endpoint every SDK example calls — the same one `/docs/sdk` uses. */
const SDK_SHOWCASE_SLUG = "pan-lite";

const buildSdks = (): AgentSdk[] => {
	const showcase = API_SPECS_MAP[SDK_SHOWCASE_SLUG];
	return [...SDK_GUIDES]
		.sort((a, b) => a.order - b.order)
		.map((g) => {
			const install = SDK_INSTALL[g.lang];
			return {
				lang: g.lang,
				slug: g.slug,
				title: g.title,
				summary: g.summary,
				packageName: g.packageName,
				installCommand: install?.command,
				registry: install?.registry,
				registryUrl: install?.registryUrl,
				minRuntime: g.minRuntime,
				dependencies: g.dependencies,
				sourceUrl: g.sourceUrl,
				docsUrl: `${SITE_URL}${sdkGuideHref(g.slug)}`,
				installNotes: g.installNotes,
				config: g.config,
				members: g.members,
				errorTypes: g.errorTypes,
				fileValues: g.fileValues,
				notes: g.notes,
				example: showcase ? sdkSampleFor(showcase, g.lang) : "",
			};
		});
};

/**
 * Build the full agent bundle. Callers should pass the documented set
 * (`getDocumentedSpecs()`).
 */
export const buildAgentBundle = (specs: ApiSpec[]): AgentBundle => {
	// `specs` is the documented set, so its slugs are exactly the endpoints that
	// have a page — the right target for both FK checks.
	const documentedSlugs = new Set(specs.map((s) => s.slug));
	assertRecipeSlugs(RECIPES, documentedSlugs);
	assertResponseTypeSlugs(specs, documentedSlugs);
	assertParamFormats(specs);

	const topics = buildTopics();
	const apis = specs.map(apiDetail);
	const recipes = RECIPES;
	const sdks = buildSdks();

	// `sdks` is DELIBERATELY excluded from the version hash. `bundleVersion` is
	// copied into `sdk-surface.json` (build-sdk-surface.ts), whose bytes are part
	// of the SDK release fingerprint (scripts/sdk-release.mjs), so hashing SDK
	// *guide copy* here would republish all five packages on every prose edit.
	// The field versions the API surface those packages embed — nothing else.
	const apiSurfaceVersion = fnv1aHex(JSON.stringify({ topics, apis, recipes }));
	const meta = {
		org: "ekoindia",
		apiVersion: API_DEFAULT_VERSION,
		bundleVersion: apiSurfaceVersion,
		environments: ENVIRONMENTS,
	};

	return { meta, topics, apis, recipes, sdks };
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
