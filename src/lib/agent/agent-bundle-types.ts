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
}

export interface AgentAuthTopic {
	id: "auth";
	backendOnly: true;
	warning: string;
	docsUrl: string;
	keys: ApiKeyInfo[];
	headers: ApiParam[];
	secretKeyGeneration: string[];
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

export interface AgentBundle {
	meta: AgentBundleMeta;
	topics: AgentTopics;
	apis: AgentApiDetail[];
	recipes: Recipe[];
}

/** Index slice: compact lists only, no full bodies. */
export interface AgentIndex {
	meta: AgentBundleMeta;
	apis: AgentApiIndexEntry[];
	topics: AgentTopicId[];
	recipes: { id: string; name: string; summary: string }[];
}
