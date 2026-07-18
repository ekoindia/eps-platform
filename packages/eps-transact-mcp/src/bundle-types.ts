// Local, self-contained copy of the agent bundle shape. Kept in parity with
// the website's src/lib/agent/agent-bundle-types.ts (guarded by a parity test).

export interface ApiParam {
	name: string;
	label?: string;
	in: "path" | "query" | "header" | "body";
	type: string;
	required: boolean;
	description?: string;
	example?: unknown;
}
export interface ResponseField {
	name: string;
	label?: string;
	type: "string" | "number" | "boolean" | "object" | "array" | "null";
	description?: string;
	imp?: boolean;
	example?: unknown;
	children?: ResponseField[];
}
export interface ApiErrorScenario {
	scenario: string;
	statusCode?: number;
	example: Record<string, unknown>;
}
export interface ApiResponseType {
	id: number;
	meaning: string;
	next?: string;
}
export interface ApiErrorCode {
	code: string | number;
	scope: "http" | "transaction";
	meaning: string;
}
export interface ApiKeyInfo {
	name: string;
	description: string;
}
export type RecipeBranchCondition =
	| { onResponseTypeId: number; onResponseStatusId?: never }
	| { onResponseStatusId: number; onResponseTypeId?: never };
export type RecipeBranch = RecipeBranchCondition & {
	goto: string;
	note?: string;
};
export interface RecipeStep {
	specSlug: string;
	purpose: string;
	branches?: RecipeBranch[];
}
export interface Recipe {
	id: string;
	name: string;
	summary: string;
	productId?: string;
	steps: RecipeStep[];
}

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
