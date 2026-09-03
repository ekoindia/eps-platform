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
import { formatPatterns } from "@/lib/data/api-formats";

/** A single request param exposed to SDKs for local validation. `type` is the
 * spec type (string | number | integer | boolean); other types pass unchecked. */
export interface SdkParam {
	name: string;
	type: string;
	required: boolean;
	/** Key into `SdkSurface.formats`; the wire string must match its pattern. */
	format?: string;
	/** Allowed values, compared as wire strings. */
	enum?: (string | number)[];
	/** Inclusive numeric bounds. */
	min?: number;
	max?: number;
	/** Max length of the wire string in UTF-8 bytes. */
	maxLength?: number;
}

export interface SdkEndpoint {
	slug: string;
	method: string;
	path: string;
	params: SdkParam[];
	/** Names of required params. Retained for back-compat; derivable from
	 * `params.filter(p => p.required)`. */
	requiredParams: string[];
	/** Money-moving endpoint: on an indeterminate failure the SDK inquires by
	 * `client_ref_id` before surfacing the error. Omitted when false. */
	financial?: boolean;
}

export interface SdkSurface {
	apiVersion: string;
	bundleVersion: string;
	environments: AgentEnvironment[];
	endpoints: SdkEndpoint[];
	errorCodes: ApiErrorCode[];
	/** Named format → portable regex source, see `api-formats.ts`. */
	formats: Record<string, string>;
}

export const buildSdkSurface = (bundle: AgentBundle): SdkSurface => ({
	apiVersion: bundle.meta.apiVersion,
	bundleVersion: bundle.meta.bundleVersion,
	environments: bundle.meta.environments,
	endpoints: bundle.apis.map((a) => {
		// Optional constraints are emitted only when set, so untouched params keep
		// their bytes (and the release fingerprint) unchanged.
		const params: SdkParam[] = a.requestParams.map((p) => ({
			name: p.name,
			type: p.type,
			required: p.required,
			...(p.format !== undefined && { format: p.format }),
			...(p.enum !== undefined && { enum: p.enum }),
			...(p.min !== undefined && { min: p.min }),
			...(p.max !== undefined && { max: p.max }),
			...(p.maxLength !== undefined && { maxLength: p.maxLength }),
		}));
		return {
			slug: a.slug,
			method: a.method,
			path: a.path,
			params,
			requiredParams: params.filter((p) => p.required).map((p) => p.name),
			...(a.financial && { financial: true }),
		};
	}),
	errorCodes: bundle.topics.errors.codes,
	formats: formatPatterns(),
});
