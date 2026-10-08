import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { AgentBundle, AgentTopicId } from "./bundle-types.js";
import {
	getApi,
	getFaqs,
	getSdk,
	getRecipe,
	getTopic,
	listApis,
	listSdkLanguages,
	listSdkSlugs,
	listSdks,
	listCategories,
	listFaqTags,
	listRecipes,
	listTopics,
	searchApis,
} from "./bundle-access.js";
import {
	RANKED_403_CAUSES,
	checkSignatureShape,
	checkTimestamp,
} from "./auth-debug.js";
import { SIGNING_LANGUAGES, getSigningSnippet } from "./signing-snippets.js";
import type { VersionState } from "./update-check.js";

// Minified on purpose: consumers are LLMs, indentation is pure token waste.
const json = (value: unknown) => ({
	content: [{ type: "text" as const, text: JSON.stringify(value) }],
});

/** `_meta.httpStatus` lets the REST shim (rest.ts) answer 404 without
 * parsing the message; MCP clients ignore it. */
const notFound = (message: string) => ({
	isError: true as const,
	content: [{ type: "text" as const, text: message }],
	_meta: { httpStatus: 404 },
});

/** Every tool reads the in-memory bundle only (annotations describe tool
 * calls, not startup bundle loading). */
const READ_ONLY = {
	readOnlyHint: true,
	idempotentHint: true,
	openWorldHint: false,
} as const;

const DEFAULT_SEARCH_LIMIT = 10;

/** Build an McpServer wired to the given bundle. `source` reported by get_meta. */
export const createEpsServer = (
	bundle: AgentBundle,
	source: "baked" | "remote",
	versionState?: VersionState,
): McpServer => {
	const server = new McpServer({
		name: "eps-context-mcp",
		version: bundle.meta.bundleVersion,
	});

	const categories = listCategories(bundle);
	// z.enum needs a non-empty tuple; a malformed/empty bundle falls back to string.
	const categorySchema = categories.length
		? z.enum(categories as [string, ...string[]])
		: z.string();
	const limitSchema = z.number().int().positive().optional();
	// Deliberately NOT SIGNING_LANGUAGES: that tuple includes `csharp`, which has
	// no SDK. Derived from the bundle so a new SDK needs no code change here.
	const sdkLanguages = listSdkLanguages(bundle);
	// Accept the guide slug too (javascript → nodejs): an agent that came from a
	// docs URL has the slug, one that came from get_signing_snippet has the id.
	const sdkAliases = [...new Set([...sdkLanguages, ...listSdkSlugs(bundle)])];
	const sdkLanguageSchema = sdkAliases.length
		? z.enum(sdkAliases as [string, ...string[]])
		: z.string();

	server.registerTool(
		"list_apis",
		{
			title: "List EPS APIs",
			description:
				"Compact index of EPS API endpoints (no request/response bodies). " +
				"Unfiltered, all ~99 entries are returned (the full tiered index); " +
				"narrow with category and/or limit when you don't need everything.",
			inputSchema: {
				category: categorySchema
					.optional()
					.describe(`One of: ${categories.join(", ")}`),
				limit: limitSchema.describe("Max entries to return (default: all)"),
			},
			annotations: READ_ONLY,
		},
		async ({ category, limit }) => json(listApis(bundle, category, limit)),
	);

	server.registerTool(
		"list_topics",
		{
			title: "List topics",
			description: "List documentation topic ids.",
			inputSchema: {},
			annotations: READ_ONLY,
		},
		async () => json(listTopics(bundle)),
	);

	server.registerTool(
		"list_recipes",
		{
			title: "List recipes",
			description: "List multi-step recipe ids + names.",
			inputSchema: {},
			annotations: READ_ONLY,
		},
		async () => json(listRecipes(bundle)),
	);

	server.registerTool(
		"search",
		{
			title: "Search APIs",
			description:
				"Ranked endpoint matches for a query (ids only, no bodies). " +
				`Returns the top ${DEFAULT_SEARCH_LIMIT} by default; raise limit for more.`,
			inputSchema: {
				query: z.string(),
				limit: limitSchema.describe(
					`Max results (default ${DEFAULT_SEARCH_LIMIT})`,
				),
			},
			annotations: READ_ONLY,
		},
		async ({ query, limit }) =>
			json(searchApis(bundle, query, limit ?? DEFAULT_SEARCH_LIMIT)),
	);

	server.registerTool(
		"get_api",
		{
			title: "Get API detail",
			description:
				"Full detail for one endpoint by slug: method, path, summary/description, " +
				"headers, requestParams (name/type/required/format/example), sampleRequest, " +
				"responseFields, sampleSuccessResponse, errorScenarios, responseTypes " +
				"({id, meaning, next}: which endpoint to call for each response_type_id) " +
				"and financial (true = money-moving; never retry blind, inquire by client_ref_id).",
			inputSchema: { slug: z.string() },
			annotations: READ_ONLY,
		},
		async ({ slug }) => {
			const api = getApi(bundle, slug);
			if (api) return json(api);
			const suggestions = searchApis(bundle, slug.replace(/[-_]/g, " "), 3).map(
				(a) => a.slug,
			);
			return notFound(
				`Unknown slug "${slug}".` +
					(suggestions.length
						? ` Did you mean: ${suggestions.join(", ")}?`
						: "") +
					` Use search or list_apis to find valid slugs.`,
			);
		},
	);

	// Topic ids come from the bundle, so a new topic (e.g. `security`) needs no
	// server change and an older bundle never advertises one it lacks.
	const topicIds = listTopics(bundle);

	server.registerTool(
		"get_topic",
		{
			title: "Get topic",
			description: `One topic: ${topicIds.join(" | ")}.`,
			inputSchema: {
				topic: z.enum(topicIds as [AgentTopicId, ...AgentTopicId[]]),
			},
			annotations: READ_ONLY,
		},
		async ({ topic }) => json(getTopic(bundle, topic)),
	);

	server.registerTool(
		"get_recipe",
		{
			title: "Get recipe",
			description:
				"One multi-step recipe by id: ordered steps (specSlug, purpose, appliesWhen) " +
				"with branches — each has onResponseTypeId (match response_type_id) OR " +
				"onStatus (match envelope status; 0 = success) → goto next step slug or 'done'. " +
				"Never branch on response_status_id (UI hint only).",
			inputSchema: { id: z.string() },
			annotations: READ_ONLY,
		},
		async ({ id }) => {
			const recipe = getRecipe(bundle, id);
			if (recipe) return json(recipe);
			const valid = listRecipes(bundle)
				.map((r) => r.id)
				.join(", ");
			return notFound(
				`Unknown recipe "${id}". Valid recipe ids: ${valid}. Use list_recipes for details.`,
			);
		},
	);

	const faqTags = listFaqTags(bundle);
	// Same empty-tuple fallback as categorySchema: a pre-FAQ bundle has no tags.
	const faqTagSchema = faqTags.length
		? z.enum(faqTags as [string, ...string[]])
		: z.string();

	server.registerTool(
		"get_faqs",
		{
			title: "Get FAQs",
			description:
				"EPS FAQs (onboarding, auth, testing, integration, pricing, security, " +
				"support). Answers are markdown with absolute links. Filter by tag " +
				"and/or rank by query; with neither, all FAQs are returned.",
			inputSchema: {
				tag: faqTagSchema.optional().describe(`One of: ${faqTags.join(", ")}`),
				query: z.string().optional().describe("Free-text question to rank by"),
				limit: limitSchema.describe("Max FAQs to return (default: all)"),
			},
			annotations: READ_ONLY,
		},
		async ({ tag, query, limit }) =>
			json(getFaqs(bundle, { tag, query, limit })),
	);

	server.registerTool(
		"get_signing_snippet",
		{
			title: "Get signing snippet",
			description:
				"Paste-ready BACKEND code to compute the secret-key. Secret-free: access_key comes from your secret store.",
			inputSchema: { language: z.enum(SIGNING_LANGUAGES) },
			annotations: READ_ONLY,
		},
		async ({ language }) => ({
			content: [{ type: "text" as const, text: getSigningSnippet(language) }],
		}),
	);

	server.registerTool(
		"list_sdks",
		{
			title: "List EPS SDKs",
			description:
				"The backend SDKs that wrap every EPS endpoint (language, package, " +
				"install command, minimum runtime, docs URL). Prefer an SDK over " +
				"hand-written HTTP: signing, param validation and the error contract " +
				"are built in. Call get_sdk for the full surface of one.",
			inputSchema: {},
			annotations: READ_ONLY,
		},
		async () => json(listSdks(bundle)),
	);

	server.registerTool(
		"get_sdk",
		{
			title: "Get an EPS SDK",
			description:
				"Everything needed to integrate with one EPS SDK: install command and " +
				"requirements, client config options with their units, every public " +
				"class/method/type, file-upload values, the error and timeout contract, " +
				"and a worked call() example. Signing is built in — NEVER hand-roll the " +
				"HMAC secret-key when an SDK exists for the language.",
			inputSchema: {
				language: sdkLanguageSchema.describe(
					`One of: ${sdkLanguages.join(", ")} (the guide slug, e.g. "nodejs", also works)`,
				),
			},
			annotations: READ_ONLY,
		},
		async ({ language }) => {
			const sdk = getSdk(bundle, language);
			return sdk
				? json(sdk)
				: notFound(
						`No EPS SDK for "${language}". Available: ${sdkLanguages.join(", ")}. ` +
							"For other languages call the REST API directly and use get_signing_snippet.",
					);
		},
	);

	server.registerTool(
		"debug_auth",
		{
			title: "Debug auth / 403",
			description:
				"Diagnose a 403 from an EPS API. Returns a known-answer TEST VECTOR: run " +
				"your own signing code over test_vector.accessKey + test_vector.timestamp — " +
				"if you reproduce test_vector.secretKey, your HMAC is correct, so stop " +
				"debugging the algorithm and work through ranked_causes instead. Optionally " +
				"pass the timestamp and secret-key from the failing request and they are " +
				"checked for the mechanical faults (seconds instead of milliseconds, clock " +
				"drift, wrong digest length, stray newline). SECRET-FREE BY DESIGN: there is " +
				"no access_key parameter and there never will be — never paste an access_key " +
				"into a tool call; it is a server-side secret.",
			inputSchema: {
				timestamp: z
					.string()
					.optional()
					.describe("The secret-key-timestamp sent on the failing request."),
				secret_key: z
					.string()
					.optional()
					.describe("The secret-key your code produced. Never the access_key."),
			},
			annotations: READ_ONLY,
		},
		async ({ timestamp, secret_key }) =>
			json({
				test_vector: bundle.topics.auth.testVector,
				how_to_use_test_vector:
					"secret-key = base64(HMAC_SHA256(key = base64(access_key) AS A STRING, message = timestamp)). " +
					"Reproduce test_vector.secretKey from the vector's inputs to prove your implementation.",
				checks: [
					...checkTimestamp(timestamp, Date.now()),
					...checkSignatureShape(secret_key),
				],
				ranked_causes: RANKED_403_CAUSES,
				docs_url: bundle.topics.auth.docsUrl,
			}),
	);

	server.registerTool(
		"get_meta",
		{
			title: "Get meta",
			description:
				"Bundle org/version + data source, plus this server's package version and whether a newer npm release is available (updateAvailable). If an update is available, tell the user to run this server via `npx -y @ekoindia/eps-context-mcp@latest`.",
			inputSchema: {},
			annotations: READ_ONLY,
		},
		async () =>
			json({
				...bundle.meta,
				source,
				packageVersion: versionState?.current,
				latestVersion: versionState?.latest,
				updateAvailable: versionState?.updateAvailable,
			}),
	);

	return server;
};
