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
import type {
	ApiField,
	ApiPreviewItem,
} from "@/components/ApiInputOutputPreview";
import { getSpecsForProduct } from "./api-specs";
import type { ApiSpec, ResponseField } from "./api-specs-common";
import { buildSampleRequest } from "./api-specs-common";
import { docHrefForSlug } from "./docs-registry";

/**
 * Helper APIs that poll the status of a bulk/async verification job. Their ids
 * end in `-status` (e.g. `pan-bulk-status`). They are hidden from product-page
 * UI (top tags, sample request/response, "what can you verify") since they are
 * not standalone verification products.
 */
const isStatusSpec = (spec: ApiSpec): boolean => spec.id.endsWith("-status");

/** Product-page-visible specs for a product (excludes `-status` helper APIs). */
const getDisplaySpecsForProduct = (productId: string): ApiSpec[] =>
	getSpecsForProduct(productId).filter((spec) => !isStatusSpec(spec));

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
	const req = buildSampleRequest(spec);
	return spec.extraRequestParams.map((p) => ({
		label: p.label || humanizeLabel(p.name),
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
			acc.push({
				label: field.label || humanizeLabel(field.name),
				value: toDisplay(field.example),
			});
		}
	}
	return acc;
};

/** Fallback when nothing is imp-flagged: top-level scalar fields. */
const topLevelScalarOutputs = (fields: ResponseField[]): ApiField[] =>
	fields
		.filter((f) => f.type !== "object" && f.type !== "array")
		.slice(0, 6)
		.map((f) => ({
			label: f.label || humanizeLabel(f.name),
			value: toDisplay(f.example),
		}));

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
		slug: spec.slug,
		inputs: requestInputs(spec),
		outputs: impOutputs.length
			? impOutputs
			: topLevelScalarOutputs(spec.responseData),
		sampleJson: {
			method: spec.method,
			endpoint: spec.path,
			request: buildSampleRequest(spec),
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

/**
 * Primary internal `/docs/<slug>` href for a set of specs — the first spec that
 * actually has a docs page (scans rather than assuming `specs[0]`, since the
 * most-relevant spec may be an inactive-product one without a page). Validated
 * against the global docs registry; use for runtime UI links.
 */
export const primaryDocHref = (specs: ApiSpec[]): string | undefined => {
	for (const spec of specs) {
		const href = docHrefForSlug(spec.slug);
		if (href) return href;
	}
	return undefined;
};

/**
 * Slug of the primary documented spec (first non-`-status`) for a set of specs.
 * Pure — derived from the given specs only, with no global-registry lookup — so
 * the markdown/agent generators stay deterministic when specs are injected.
 */
export const primaryDocSlug = (specs: ApiSpec[]): string | undefined =>
	specs.find((spec) => !isStatusSpec(spec))?.slug;

/** Convenience: previews for a product id via the global registry. */
export const getApiPreviewsForProduct = (
	productId: string,
	limit?: number,
): ApiPreviewItem[] =>
	specsToPreviews(getDisplaySpecsForProduct(productId), limit);

/** Convenience: internal `/docs/<slug>` href for a product id. */
export const getProductDocHref = (productId: string): string | undefined =>
	primaryDocHref(getDisplaySpecsForProduct(productId));

// ---------------------------------------------------------------------------
// "What can you verify" — important (imp) response fields, deduped per product
// ---------------------------------------------------------------------------

/** An important, verifiable response field surfaced to the user. */
export interface VerifiableField {
	label: string;
	description?: string;
}

/** Recursively collect every imp-flagged field (parent or leaf) from a tree. */
const collectImpFields = (
	fields: ResponseField[],
	acc: { name: string; label: string; description?: string }[] = [],
): { name: string; label: string; description?: string }[] => {
	for (const field of fields) {
		if (field.imp) {
			acc.push({
				name: field.name,
				label: field.label || humanizeLabel(field.name),
				description: field.description,
			});
		}
		if (field.children?.length) collectImpFields(field.children, acc);
	}
	return acc;
};

/**
 * Combine the imp-flagged response fields across all of a product's API specs,
 * deduped by field name (first wins; a later duplicate's description backfills
 * an earlier blank one).
 */
export const specsToVerifiableFields = (
	specs: ApiSpec[],
): VerifiableField[] => {
	const byName = new Map<string, VerifiableField>();
	for (const spec of specs) {
		for (const f of collectImpFields(spec.responseData)) {
			if (f.name.toLowerCase().includes("reference_id")) continue;
			const key = f.name.toLowerCase();
			const existing = byName.get(key);
			if (!existing) {
				byName.set(key, { label: f.label, description: f.description });
			} else if (!existing.description && f.description) {
				existing.description = f.description;
			}
		}
	}
	return [...byName.values()];
};

/** Convenience: verifiable fields for a product id via the global registry. */
export const getVerifiableFieldsForProduct = (
	productId: string,
): VerifiableField[] =>
	specsToVerifiableFields(getDisplaySpecsForProduct(productId));

/** Section heading, e.g. "What Can You Verify With PAN Verification API?". */
export const verifyHeading = (
	productName: string,
	multiApi?: boolean,
): string =>
	`What Can You Verify With ${productName.replace(/\s+API$/i, "")} API${
		multiApi ? "s" : ""
	}?`;
