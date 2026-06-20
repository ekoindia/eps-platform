/**
 * Build-time markdown twin for a developer-docs endpoint page (`/docs/<slug>.md`).
 *
 * Derived entirely from the shared spec resolvers, mirroring the on-page
 * `EndpointDetail` so the AI/markdown view stays in lock-step with the HTML.
 * Dependency-free (runs in the Vite build SSR context and unit tests).
 */
import { SITE_URL } from "@/lib/config/site";
import { DEFAULT_BASE_URL } from "@/lib/data/api-auth";
import type {
	ApiParam,
	ApiSpec,
	ResponseField,
} from "@/lib/data/api-specs-common";
import {
	buildSampleRequest,
	resolveHeaders,
	resolveRequestParams,
	resolveResponseFields,
} from "@/lib/data/api-specs-common";
import {
	buildNavTree,
	docsHref,
	endpointSlug,
	type NavLeaf,
	type NavNode,
} from "@/lib/data/docs-registry";
import {
	bulletList,
	canonicalNotice,
	frontMatter,
	h1,
	h2,
	joinBlocks,
	link,
	markdownTable,
} from "./shared";

const paramRows = (params: ApiParam[]): string[][] =>
	params.map((p) => [
		p.name,
		p.type,
		p.required ? "yes" : "no",
		[p.description, p.example !== undefined ? `e.g. ${String(p.example)}` : ""]
			.filter(Boolean)
			.join(" "),
	]);

/** Flatten a (possibly nested) response tree into dotted-path rows. */
const responseRows = (fields: ResponseField[], prefix = ""): string[][] => {
	const rows: string[][] = [];
	for (const field of fields) {
		const name = prefix ? `${prefix}.${field.name}` : field.name;
		rows.push([
			field.imp ? `${name} ⭐` : name,
			field.type,
			field.description ?? field.label ?? "",
		]);
		if (field.children?.length) {
			rows.push(...responseRows(field.children, name));
		}
	}
	return rows;
};

const jsonFence = (value: unknown): string =>
	["```json", JSON.stringify(value, null, 2), "```"].join("\n");

const paramTable = (params: ApiParam[]): string =>
	markdownTable(
		["Field", "Type", "Required", "Description"],
		paramRows(params),
	);

/** Render a single endpoint's markdown twin. */
export function renderEndpointMarkdown(spec: ApiSpec): string {
	const canonical = `${SITE_URL}${docsHref(endpointSlug(spec))}`;
	const requestParams = resolveRequestParams(spec);
	const pathParams = requestParams.filter((p) => p.in === "path");
	const queryParams = requestParams.filter((p) => p.in === "query");
	const bodyParams = requestParams.filter((p) => p.in === "body");
	const sampleRequest = buildSampleRequest(spec);
	const hasSampleRequest = Object.keys(sampleRequest).length > 0;

	return joinBlocks([
		frontMatter({
			title: `${spec.name} API Reference`,
			description: spec.summary,
			canonical,
		}),
		canonicalNotice(canonical),
		h1(`${spec.name} API Reference`),
		`\`${spec.method} ${DEFAULT_BASE_URL}${spec.path}\``,
		spec.summary,
		spec.description,
		pathParams.length ? h2("Path parameters") : undefined,
		pathParams.length ? paramTable(pathParams) : undefined,
		queryParams.length ? h2("Query parameters") : undefined,
		queryParams.length ? paramTable(queryParams) : undefined,
		bodyParams.length ? h2("Body parameters") : undefined,
		bodyParams.length ? paramTable(bodyParams) : undefined,
		h2("Headers"),
		paramTable(resolveHeaders()),
		h2("Response"),
		"⭐ marks fields highlighted as verifiable.",
		markdownTable(
			["Field", "Type", "Description"],
			responseRows(resolveResponseFields(spec)),
		),
		hasSampleRequest ? h2("Example request") : undefined,
		hasSampleRequest ? jsonFence(sampleRequest) : undefined,
		h2("Example response"),
		jsonFence(spec.sampleSuccessResponse),
		spec.errorScenarios?.length ? h2("Error scenarios") : undefined,
		spec.errorScenarios?.length
			? markdownTable(
					["Status", "Scenario"],
					spec.errorScenarios.map((e) => [
						String(e.statusCode ?? 200),
						e.scenario,
					]),
				)
			: undefined,
	]);
}

/**
 * Render a guide's `/docs/<slug>.md` twin from its raw MDX source. Guides are
 * authored as pure GFM markdown (no JSX/imports), so the raw body is valid
 * markdown — we just prepend front-matter + the canonical notice.
 */
export function renderGuideMarkdown(
	meta: { slug: string; title: string; summary?: string },
	rawBody: string,
): string {
	const canonical = `${SITE_URL}${docsHref(meta.slug)}`;
	return joinBlocks([
		frontMatter({
			title: meta.title,
			description: meta.summary,
			canonical,
		}),
		canonicalNotice(canonical),
		rawBody.trim(),
	]);
}

/** Flatten the recursive nav tree to leaves, each with its branch-label trail
 * (Product › Provider › Group) for context in the flat overview list. */
const collectLeaves = (
	nodes: NavNode[],
	trail: string[] = [],
): { leaf: NavLeaf; trail: string[] }[] =>
	nodes.flatMap((node) =>
		node.type === "leaf"
			? [{ leaf: node, trail }]
			: collectLeaves(node.children, [...trail, node.label]),
	);

/** Render the `/docs.md` overview: every documented endpoint, grouped. */
export function renderDocsIndexMarkdown(): string {
	const nav = buildNavTree();
	const canonical = `${SITE_URL}/docs`;

	const sections = nav.categories.map((category) =>
		joinBlocks([
			h2(category.title),
			bulletList(
				collectLeaves(category.nodes).map(({ leaf, trail }) => {
					const context = trail.length ? ` — ${trail.join(" › ")}` : "";
					return `${link(leaf.title, `${SITE_URL}${docsHref(leaf.slug)}`, "md")} (${leaf.method})${context}`;
				}),
			),
		]),
	);

	return joinBlocks([
		frontMatter({
			title: "Developer Documentation",
			description:
				"API reference and integration guides for Eko's KYC, verification, payment and banking REST APIs.",
			canonical,
		}),
		canonicalNotice(canonical),
		h1("Developer Documentation"),
		"Integrate Eko's KYC, verification, payment and banking APIs. Each endpoint is documented with parameters, responses, code samples and a live request console.",
		...sections,
	]);
}
