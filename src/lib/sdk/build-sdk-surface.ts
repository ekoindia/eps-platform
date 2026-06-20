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

/** A single request param exposed to SDKs for local validation. `type` is the
 * spec type (string | number | integer | boolean); other types pass unchecked. */
export interface SdkParam {
	name: string;
	type: string;
	required: boolean;
}

export interface SdkEndpoint {
	slug: string;
	method: string;
	path: string;
	params: SdkParam[];
	/** Names of required params. Retained for back-compat; derivable from
	 * `params.filter(p => p.required)`. */
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
	endpoints: bundle.apis.map((a) => {
		const params: SdkParam[] = a.requestParams.map((p) => ({
			name: p.name,
			type: p.type,
			required: p.required,
		}));
		return {
			slug: a.slug,
			method: a.method,
			path: a.path,
			params,
			requiredParams: params.filter((p) => p.required).map((p) => p.name),
		};
	}),
	errorCodes: bundle.topics.errors.codes,
});
