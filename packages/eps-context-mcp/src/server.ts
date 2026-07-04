import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { AgentBundle } from "./bundle-types.js";
import {
	getApi,
	getRecipe,
	getTopic,
	listApis,
	listCategories,
	listRecipes,
	listTopics,
	searchApis,
} from "./bundle-access.js";
import { SIGNING_LANGUAGES, getSigningSnippet } from "./signing-snippets.js";
import type { VersionState } from "./update-check.js";

// Minified on purpose: consumers are LLMs, indentation is pure token waste.
const json = (value: unknown) => ({
	content: [{ type: "text" as const, text: JSON.stringify(value) }],
});

const notFound = (message: string) => ({
	isError: true as const,
	content: [{ type: "text" as const, text: message }],
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
			description: "Full detail for one endpoint by slug.",
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

	server.registerTool(
		"get_topic",
		{
			title: "Get topic",
			description: "One topic: auth | errors | pricing | environments.",
			inputSchema: {
				topic: z.enum(["auth", "errors", "pricing", "environments"]),
			},
			annotations: READ_ONLY,
		},
		async ({ topic }) => json(getTopic(bundle, topic)),
	);

	server.registerTool(
		"get_recipe",
		{
			title: "Get recipe",
			description: "One multi-step recipe (steps + branches) by id.",
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
