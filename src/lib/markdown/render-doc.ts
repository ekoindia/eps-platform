/**
 * Build-time markdown twin for a developer-docs endpoint page (`/docs/<slug>.md`).
 *
 * Derived entirely from the shared spec resolvers, mirroring the on-page
 * `EndpointDetail` so the AI/markdown view stays in lock-step with the HTML.
 * Dependency-free (runs in the Vite build SSR context and unit tests).
 */
import { SIGNUP_URL, SITE_URL } from "@/lib/config/site";
import {
	API_ENVIRONMENTS,
	AUTH_HEADERS,
	DEFAULT_BASE_URL,
} from "@/lib/data/api-auth";
import { ACTIVE_PRODUCTS_MAP, productHref } from "@/lib/data/api-products";
import { recipeHref } from "@/lib/data/api-recipes";
import type {
	ApiErrorScenario,
	ApiParam,
	ApiResponseType,
	ApiSpec,
	ResponseField,
} from "@/lib/data/api-specs-common";
import {
	buildSampleRequest,
	resolveHeaders,
	resolveRequestParams,
	resolveResponseFields,
	responseTypeFor,
} from "@/lib/data/api-specs-common";
import {
	buildNavTree,
	docHrefForSlug,
	docsHref,
	endpointSlug,
	type NavLeaf,
	type NavNode,
} from "@/lib/data/docs-registry";
import { resolveShortDescription } from "@/lib/data/endpoint-descriptions";
import { defaultSnippet } from "@/lib/docs/code-snippet-sets";
import {
	aiGettingStartedNotice,
	bulletList,
	canonicalNotice,
	frontMatter,
	h1,
	h2,
	h3,
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

/** A response type's next endpoint, linked to its markdown twin. */
const nextStepCell = (responseType: ApiResponseType): string => {
	if (!responseType.next) return "—";
	const href = docHrefForSlug(responseType.next);
	// No page ⇒ no link, same guard the HTML table applies.
	return href
		? link(responseType.next, `${SITE_URL}${href}.md`, "md")
		: responseType.next;
};

/** The `response_type_id` of an error example, when the spec documents it. */
const errorScenarioTypeCell = (
	spec: ApiSpec,
	scenario: ApiErrorScenario,
): string => {
	const responseType = responseTypeFor(spec, scenario.example);
	if (responseType) return `\`${responseType.id}\` — ${responseType.meaning}`;
	const id = scenario.example.response_type_id;
	return typeof id === "number" ? `\`${id}\`` : "—";
};

/** One-line annotation under an example: what its response type means, and
 * where to go next. Absent when the payload carries no documented id. */
const responseTypeLine = (
	spec: ApiSpec,
	payload: Record<string, unknown>,
): string | undefined => {
	const responseType = responseTypeFor(spec, payload);
	if (!responseType) return undefined;
	const next = responseType.next
		? ` Next step: ${nextStepCell(responseType)}.`
		: "";
	return `\`response_type_id\` \`${responseType.id}\` — ${responseType.meaning}.${next}`;
};

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
	const product = ACTIVE_PRODUCTS_MAP[spec.productId];

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
		resolveShortDescription(spec),
		product &&
			`> View product & pricing details: ${link(product.name, `${SITE_URL}${productHref(product.slug)}.md`, "md")}`,
		pathParams.length ? h2("Path parameters") : undefined,
		pathParams.length ? paramTable(pathParams) : undefined,
		queryParams.length ? h2("Query parameters") : undefined,
		queryParams.length ? paramTable(queryParams) : undefined,
		bodyParams.length ? h2("Body parameters") : undefined,
		bodyParams.length ? paramTable(bodyParams) : undefined,
		h2("Headers"),
		paramTable(resolveHeaders(spec)),
		h2("Response"),
		"⭐ marks fields highlighted as verifiable.",
		markdownTable(
			["Field", "Type", "Description"],
			responseRows(resolveResponseFields(spec)),
		),
		spec.responseTypes?.length ? h2("Response types") : undefined,
		spec.responseTypes?.length
			? "Branch on `response_type_id` to decide the next call:"
			: undefined,
		spec.responseTypes?.length
			? markdownTable(
					["response_type_id", "Meaning", "Next step"],
					spec.responseTypes.map((rt) => [
						String(rt.id),
						rt.meaning,
						nextStepCell(rt),
					]),
				)
			: undefined,
		hasSampleRequest ? h2("Example request") : undefined,
		hasSampleRequest ? jsonFence(sampleRequest) : undefined,
		h2("Example response"),
		responseTypeLine(spec, spec.sampleSuccessResponse),
		jsonFence(spec.sampleSuccessResponse),
		spec.errorScenarios?.length ? h2("Error scenarios") : undefined,
		spec.errorScenarios?.length
			? markdownTable(
					["Status", "response_type_id", "Scenario"],
					spec.errorScenarios.map((e) => [
						String(e.statusCode ?? 200),
						errorScenarioTypeCell(spec, e),
						e.scenario,
					]),
				)
			: undefined,
	]);
}

/** Matches `<CodeSnippets id="…" />` (self-closing) or its empty paired form. */
const CODE_SNIPPETS_TAG =
	/<CodeSnippets\s+id="([^"]+)"\s*(?:\/>|>\s*<\/CodeSnippets>)/g;

/**
 * Expand every `<CodeSnippets id="…" />` MDX tag into a fenced code block of the
 * set's DEFAULT-language snippet, so the `.md` twin carries one copy-pasteable
 * sample while the HTML page shows all languages as tabs. Throws on an unknown
 * id or any unrecognised `<CodeSnippets …>` form rather than leaking raw JSX
 * into the markdown twin.
 */
function expandCodeSnippets(body: string): string {
	const out = body.replace(CODE_SNIPPETS_TAG, (_match, id: string) => {
		const snippet = defaultSnippet(id);
		if (!snippet)
			throw new Error(`renderGuideMarkdown: unknown <CodeSnippets id="${id}">`);
		return ["```" + snippet.language, snippet.code.trim(), "```"].join("\n");
	});
	if (/<CodeSnippets\b/.test(out))
		throw new Error(
			'renderGuideMarkdown: unrecognised <CodeSnippets> form — expected <CodeSnippets id="…" />',
		);
	return out;
}

/** Matches `<RdServiceTester />` (self-closing) or its empty paired form,
 * tolerating internal whitespace/newlines. The component takes no props. */
const RD_SERVICE_TESTER_TAG =
	/<RdServiceTester\s*(?:\/>|>\s*<\/RdServiceTester\s*>)/g;

/**
 * Replace the browser-only `<RdServiceTester />` widget with a static pointer
 * in the `.md` twin — the interactive tester probes localhost drivers and only
 * exists on the HTML page. Throws on any other `<RdServiceTester …>` form
 * rather than leaking raw JSX into the markdown twin.
 */
function expandRdServiceTester(body: string, slug: string): string {
	const out = body.replace(
		RD_SERVICE_TESTER_TAG,
		`> **Interactive RDService device tester** — available on the HTML version ` +
			`of this page (${SITE_URL}${docsHref(slug)}). It runs in the browser and ` +
			`probes the locally-installed RDService driver, so it has no markdown equivalent.`,
	);
	if (/<RdServiceTester\b/.test(out))
		throw new Error(
			"renderGuideMarkdown: unrecognised <RdServiceTester> form — expected <RdServiceTester /> with no props",
		);
	return out;
}

/**
 * Render a guide's `/docs/<slug>.md` twin from its raw MDX source. Guides are
 * authored as GFM markdown that may embed the `<CodeSnippets id="…" />`
 * component; that tag is expanded here to a fenced block of its default
 * (first) language so the twin stays valid, single-language markdown. The
 * browser-only `<RdServiceTester />` widget becomes a static note. All other
 * content is plain GFM, emitted verbatim under front-matter + the canonical notice.
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
		expandCodeSnippets(expandRdServiceTester(rawBody.trim(), meta.slug)),
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
			h3(category.title),
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

		h2("Getting Started for AI Coding Agents"),
		aiGettingStartedNotice(),

		h2("Getting Started for Developers"),
		bulletList([
			`**Get credentials** — Eko's UAT / sandbox is self-serve. Sign up at ${SIGNUP_URL} with your mobile number, verify with your PAN, and test our verification APIs live. Once you are satisfied, goto ${SITE_URL}/ai to integrate quickly with our free AI tools (MCP servers, plugins, skills, etc for your coding agent). ${API_ENVIRONMENTS.production.note}`,
			`**Know your environments** — ${API_ENVIRONMENTS.sandbox.label}: \`${API_ENVIRONMENTS.sandbox.baseUrl}\`, ${API_ENVIRONMENTS.production.label}: \`${API_ENVIRONMENTS.production.baseUrl}\`. The full endpoint URL is always \`baseUrl + path\`.`,
			`**Sign every request** — send these headers on every call: ${AUTH_HEADERS.map((h) => `\`${h.name}\``).join(", ")}. The \`secret-key\` is a per-request HMAC signature — see ${link("How Auth Works", `${SITE_URL}${docsHref("how-auth-works")}`, "md")}.`,
			"**Make your first call** — pick an endpoint below (start with PAN Lite), drop in your credentials, and send it.",
			`**Handle the response** — EPS APIs share a common envelope: \`status\` (\`0\` = success), \`response_status_id\`, \`message\`, and the payload under \`data\`. See ${link("Status & Error Codes", `${SITE_URL}${docsHref("error-codes")}`, "md")}.`,
		]),

		h2("Recipes — multi-step workflows"),
		`The references below document one endpoint each. Recipes document how to combine several into a complete flow (onboard a sender, then transfer; activate an agent, then withdraw): ${link("All API Recipes", `${SITE_URL}${recipeHref()}.md`, "md")}.`,

		h2("All API Endpoints"),
		...sections,
	]);
}
