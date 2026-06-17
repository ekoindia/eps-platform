/**
 * Pure builder for the language-neutral SDK surface embedded by every signed
 * SDK: environments, a thin endpoint catalog, and the error-code table. Derived
 * from the agent bundle; no I/O, no Date (byte-stable).
 */
import type {
	AgentBundle,
	AgentEnvironment,
} from "@/lib/agent/agent-bundle-types";
import type { ApiErrorCode } from "@/lib/data/api-error-codes";

export interface SdkEndpoint {
	slug: string;
	method: string;
	path: string;
	requiredParams: string[];
}

export interface SdkSurface {
	apiVersion: string;
	bundleVersion: string;
	environments: AgentEnvironment[];
	endpoints: SdkEndpoint[];
	errorCodes: ApiErrorCode[];
}

export const buildSdkSurface = (bundle: AgentBundle): SdkSurface => ({
	apiVersion: bundle.meta.apiVersion,
	bundleVersion: bundle.meta.bundleVersion,
	environments: bundle.meta.environments,
	endpoints: bundle.apis.map((a) => ({
		slug: a.slug,
		method: a.method,
		path: a.path,
		requiredParams: a.requestParams
			.filter((p) => p.required)
			.map((p) => p.name),
	})),
	errorCodes: bundle.topics.errors.codes,
});
