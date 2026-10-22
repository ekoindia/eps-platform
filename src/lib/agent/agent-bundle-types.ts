/**
 * Shape of the canonical agent bundle (`/agent/eps.json`) and its split slices.
 *
 * This is the single machine-readable artifact every downstream agent feature
 * (MCP, context packs, SDKs) consumes. It is assembled by `build-agent-bundle.ts`
 * from the spec layer + `api-recipes.ts`, and is pure/deterministic.
 */
import type {
	ApiErrorScenario,
	ApiParam,
	ResponseField,
	ApiResponseType,
	ApiSemantics,
} from "@/lib/data/api-specs-common";
import type { ApiErrorCode } from "@/lib/data/api-error-codes";
import type { ApiKeyInfo } from "@/lib/data/api-auth";
import type { Recipe } from "@/lib/data/api-recipes";

export interface AgentEnvironment {
	id: string;
	label: string;
	baseUrl: string;
	note?: string;
}

export interface AgentBundleMeta {
	org: string;
	apiVersion: string;
	/** Deterministic content hash of `{ topics, apis, recipes }` (no Date). */
	bundleVersion: string;
	environments: AgentEnvironment[];
}

/** Compact, body-free entry used by the index slice. */
export interface AgentApiIndexEntry {
	slug: string;
	productId: string;
	productName: string;
	name: string;
	method: string;
	path: string;
	summary: string;
	category: string;
	relevance?: string;
	/** Human docs page for this endpoint (`/docs/<slug>`). */
	docsUrl: string;
	/** Product page, when the product has one. Not stored on `apis` (that would
	 * change `bundleVersion`); readers join it from `AgentBundle.pages`. */
	productUrl?: string;
}

/** Full per-endpoint detail (the `api/<slug>.json` slice). */
export interface AgentApiDetail extends AgentApiIndexEntry {
	description?: string;
	bestFor?: string;
	financial?: boolean;
	/** Behaviour labels: read-only / idempotent / billable / side effects. Set
	 * on every documented endpoint; absent only in bundles built before
	 * 2026-10-15 — treat absence as unknown, never as read-only. */
	semantics?: ApiSemantics;
	/** Eko internal transaction-type id (`trxn_type_id`), when known. */
	trxnTypeId?: number;
	/** Eko EPS product code (`eps_product_code`), when known. */
	epsProductCode?: number;
	/** True when UAT/sandbox is not available: calls there return an error. */
	uatUnavailable?: boolean;
	headers: ApiParam[];
	requestParams: ApiParam[];
	sampleRequest: Record<string, unknown>;
	responseFields: ResponseField[];
	sampleSuccessResponse: Record<string, unknown>;
	errorScenarios: ApiErrorScenario[];
	/** Documented `response_type_id` values: meaning + the slug to call next.
	 * Empty when the endpoint documents no branching. */
	responseTypes: ApiResponseType[];
}

export interface AgentAuthTopic {
	id: "auth";
	backendOnly: true;
	warning: string;
	docsUrl: string;
	keys: ApiKeyInfo[];
	headers: ApiParam[];
	secretKeyGeneration: string[];
	/** Known-answer test: sign `timestamp` with `accessKey` and the result must
	 * equal `secretKey`. The key is a dummy — it proves an implementation is
	 * correct without anyone handling a real credential. */
	testVector: { accessKey: string; timestamp: string; secretKey: string };
}

export interface AgentErrorsTopic {
	id: "errors";
	docsUrl: string;
	codes: ApiErrorCode[];
}

export interface AgentPricingTopic {
	id: "pricing";
	/** Human page; joined from `AgentBundle.pages.topics` by readers. */
	docsUrl?: string;
	summary: string;
	links: { label: string; url: string }[];
}

export interface AgentEnvironmentsTopic {
	id: "environments";
	environments: AgentEnvironment[];
}

export interface AgentGettingStartedTopic {
	id: "getting-started";
	/** Human page; joined from `AgentBundle.pages.topics` by readers. */
	docsUrl?: string;
	summary: string;
	steps: { title: string; detail: string; url?: string }[];
	links: { label: string; url: string }[];
}

export interface AgentSecurityTopic {
	id: "security";
	/** Canonical human page. */
	url: string;
	/** Same page as `url`, under the name every other topic uses; joined from
	 * `AgentBundle.pages.topics` by readers. */
	docsUrl?: string;
	summary: string;
	/** IT-confirmed statements, markdown with absolute links. */
	sections: { id: string; title: string; points: string[] }[];
}

export interface AgentTopics {
	auth: AgentAuthTopic;
	errors: AgentErrorsTopic;
	pricing: AgentPricingTopic;
	environments: AgentEnvironmentsTopic;
	"getting-started": AgentGettingStartedTopic;
	security: AgentSecurityTopic;
}

export type AgentTopicId = keyof AgentTopics;

/** One backend SDK: how to install it and what its client surface looks like.
 * Derived from `SDK_GUIDES` in `src/lib/data/sdk-guides.ts`, which is also what
 * the `/docs/sdk/<slug>` pages and their markdown twins render. */
export interface AgentSdk {
	/** Language id (`javascript` | `python` | `php` | `go` | `java`). */
	lang: string;
	/** URL segment of its guide — NOT derivable from `lang` (javascript → nodejs). */
	slug: string;
	title: string;
	summary: string;
	packageName: string;
	installCommand?: string;
	registry?: string;
	registryUrl?: string;
	minRuntime: string;
	dependencies: string;
	sourceUrl: string;
	docsUrl: string;
	installNotes?: string[];
	config: {
		name: string;
		type: string;
		required: boolean;
		description: string;
		units?: string;
	}[];
	members: {
		kind: string;
		name: string;
		signature: string;
		description: string;
	}[];
	errorTypes: { name: string; when: string; fields?: string }[];
	fileValues: string[];
	notes?: string[];
	/** A worked `call()` example in this language, for the showcase endpoint. */
	example: string;
}

/** One FAQ: `a` is markdown with absolute site links. */
export interface AgentFaq {
	q: string;
	a: string;
	tag?: string;
	links?: { label: string; href: string }[];
	/** Human page this FAQ appears on (`/faq`, or `/pricing` for pricing). */
	docsUrl?: string;
}

/** Absolute human-page URLs, keyed by id. Kept out of `apis`/`recipes`/`topics`
 * so URL changes never move `bundleVersion` (and never republish the SDKs). */
export interface AgentPages {
	/** productId → `/products/<slug>`; products with no page are absent. */
	products: Record<string, string>;
	/** recipe id → `/recipe/<slug>`. */
	recipes: Record<string, string>;
	/** topic id → its human page; topics with no page are absent. */
	topics: Partial<Record<AgentTopicId, string>>;
}

export interface AgentBundle {
	meta: AgentBundleMeta;
	topics: AgentTopics;
	apis: AgentApiDetail[];
	recipes: Recipe[];
	sdks: AgentSdk[];
	/** Optional: bundles built before FAQs shipped have none. */
	faqs?: AgentFaq[];
	/** Optional: bundles built before page URLs shipped have none. */
	pages?: AgentPages;
}

/** Index slice: compact lists only, no full bodies. */
export interface AgentIndex {
	meta: AgentBundleMeta;
	apis: AgentApiIndexEntry[];
	topics: AgentTopicId[];
	recipes: { id: string; name: string; summary: string; docsUrl?: string }[];
}
