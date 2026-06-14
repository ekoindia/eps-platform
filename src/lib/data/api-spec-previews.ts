/**
 * Presentation adapters that derive product-page API previews from the
 * technical {@link ApiSpec} registry (`api-specs.ts`).
 *
 * Product pages and the markdown/LLM generators no longer store technical API
 * data — they render it from here, keeping `api-specs.ts` the single source of
 * truth. The pure `specsTo*` / `*DocsUrl(specs)` helpers take specs as input so
 * callers (and tests) stay deterministic; the `get*ForProduct` convenience
 * wrappers read the global registry.
 */
import type { ApiField, ApiPreviewItem } from "@/components/ApiInputOutputPreview";
import { getSpecsForProduct } from "./api-specs";
import type { ApiSpec, ResponseField } from "./api-specs-common";

/** snake_case / kebab / camelCase -> "Title Case" label. */
const humanizeLabel = (name: string): string =>
	name
		.replace(/[_-]+/g, " ")
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/\s+/g, " ")
		.trim()
		.replace(/\b\w/g, (c) => c.toUpperCase());

const toDisplay = (value: unknown): string =>
	value == null
		? ""
		: typeof value === "object"
			? JSON.stringify(value)
			: String(value);

/** API-specific request params -> display inputs, valued from sampleRequest. */
const requestInputs = (spec: ApiSpec): ApiField[] => {
	const req = (spec.sampleRequest ?? {}) as Record<string, unknown>;
	return spec.extraRequestParams.map((p) => ({
		label: humanizeLabel(p.name),
		value: toDisplay(req[p.name] ?? p.example ?? ""),
	}));
};

/** Recursively collect imp-flagged scalar response fields as display outputs. */
const collectImpOutputs = (
	fields: ResponseField[],
	acc: ApiField[] = [],
): ApiField[] => {
	for (const field of fields) {
		if (field.children?.length) {
			collectImpOutputs(field.children, acc);
		} else if (field.imp) {
			acc.push({ label: humanizeLabel(field.name), value: toDisplay(field.example) });
		}
	}
	return acc;
};

/** Fallback when nothing is imp-flagged: top-level scalar fields. */
const topLevelScalarOutputs = (fields: ResponseField[]): ApiField[] =>
	fields
		.filter((f) => f.type !== "object" && f.type !== "array")
		.slice(0, 6)
		.map((f) => ({ label: humanizeLabel(f.name), value: toDisplay(f.example) }));

/** Map one technical spec to the product-page preview shape. */
export const specToPreview = (spec: ApiSpec): ApiPreviewItem => {
	const impOutputs = collectImpOutputs(spec.responseData);
	return {
		apiName: spec.name,
		description: spec.summary,
		method: spec.method,
		endpoint: spec.path,
		relevance: spec.relevance,
		bestFor: spec.bestFor,
		docsUrl: spec.docsUrl,
		inputs: requestInputs(spec),
		outputs: impOutputs.length ? impOutputs : topLevelScalarOutputs(spec.responseData),
		sampleJson: {
			method: spec.method,
			endpoint: spec.path,
			request: spec.sampleRequest,
			response: spec.sampleSuccessResponse,
		},
	};
};

/** Presentation previews for a set of specs (optionally capped). */
export const specsToPreviews = (
	specs: ApiSpec[],
	limit?: number,
): ApiPreviewItem[] =>
	(limit ? specs.slice(0, limit) : specs).map(specToPreview);

/** Primary developer-docs link for a set of specs (most-relevant first). */
export const primaryDocsUrl = (specs: ApiSpec[]): string | undefined =>
	specs[0]?.docsUrl;

/** Convenience: previews for a product id via the global registry. */
export const getApiPreviewsForProduct = (
	productId: string,
	limit?: number,
): ApiPreviewItem[] => specsToPreviews(getSpecsForProduct(productId), limit);

/** Convenience: primary docs url for a product id via the global registry. */
export const getProductDocsUrl = (productId: string): string | undefined =>
	primaryDocsUrl(getSpecsForProduct(productId));
