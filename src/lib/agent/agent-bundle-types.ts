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
}

/** Full per-endpoint detail (the `api/<slug>.json` slice). */
export interface AgentApiDetail extends AgentApiIndexEntry {
	description?: string;
	bestFor?: string;
	docsUrl: string;
	financial?: boolean;
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
	summary: string;
	links: { label: string; url: string }[];
}

export interface AgentEnvironmentsTopic {
	id: "environments";
	environments: AgentEnvironment[];
}

export interface AgentGettingStartedTopic {
	id: "getting-started";
	summary: string;
	steps: { title: string; detail: string; url?: string }[];
	links: { label: string; url: string }[];
}

export interface AgentTopics {
	auth: AgentAuthTopic;
	errors: AgentErrorsTopic;
	pricing: AgentPricingTopic;
	environments: AgentEnvironmentsTopic;
	"getting-started": AgentGettingStartedTopic;
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

export interface AgentBundle {
	meta: AgentBundleMeta;
	topics: AgentTopics;
	apis: AgentApiDetail[];
	recipes: Recipe[];
	sdks: AgentSdk[];
}

/** Index slice: compact lists only, no full bodies. */
export interface AgentIndex {
	meta: AgentBundleMeta;
	apis: AgentApiIndexEntry[];
	topics: AgentTopicId[];
	recipes: { id: string; name: string; summary: string }[];
}
