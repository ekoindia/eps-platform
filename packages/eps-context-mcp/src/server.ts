import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { AgentBundle } from "./bundle-types.js";
import {
	getApi,
	getRecipe,
	getTopic,
	listApis,
	listRecipes,
	listTopics,
	searchApis,
} from "./bundle-access.js";
import { SIGNING_LANGUAGES, getSigningSnippet } from "./signing-snippets.js";
import type { VersionState } from "./update-check.js";

const json = (value: unknown) => ({
	content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});

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

	server.registerTool(
		"list_apis",
		{
			title: "List EPS APIs",
			description:
				"Compact index of EPS API endpoints (no request/response bodies). Optionally filter by category.",
			inputSchema: { category: z.string().optional() },
		},
		async ({ category }) => json(listApis(bundle, category)),
	);

	server.registerTool(
		"list_topics",
		{
			title: "List topics",
			description: "List documentation topic ids.",
			inputSchema: {},
		},
		async () => json(listTopics(bundle)),
	);

	server.registerTool(
		"list_recipes",
		{
			title: "List recipes",
			description: "List multi-step recipe ids + names.",
			inputSchema: {},
		},
		async () => json(listRecipes(bundle)),
	);

	server.registerTool(
		"search",
		{
			title: "Search APIs",
			description: "Ranked endpoint matches for a query (ids only, no bodies).",
			inputSchema: { query: z.string() },
		},
		async ({ query }) => json(searchApis(bundle, query)),
	);

	server.registerTool(
		"get_api",
		{
			title: "Get API detail",
			description: "Full detail for one endpoint by slug.",
			inputSchema: { slug: z.string() },
		},
		async ({ slug }) => {
			const api = getApi(bundle, slug);
			return api ? json(api) : json({ error: `Unknown slug "${slug}"` });
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
		},
		async ({ topic }) => json(getTopic(bundle, topic)),
	);

	server.registerTool(
		"get_recipe",
		{
			title: "Get recipe",
			description: "One multi-step recipe (steps + branches) by id.",
			inputSchema: { id: z.string() },
		},
		async ({ id }) => {
			const recipe = getRecipe(bundle, id);
			return recipe ? json(recipe) : json({ error: `Unknown recipe "${id}"` });
		},
	);

	server.registerTool(
		"get_signing_snippet",
		{
			title: "Get signing snippet",
			description:
				"Paste-ready BACKEND code to compute the secret-key. Secret-free: access_key comes from your secret store.",
			inputSchema: { language: z.enum(SIGNING_LANGUAGES) },
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
