/**
 * The tool surface the docs-chat model drives, and its in-process dispatcher.
 *
 * These are the same lookups `eps-context-mcp` exposes over MCP, executed here
 * as ordinary function calls against the shared bundle. Routing them through
 * the public `/context/mcp` endpoint instead would send every call out to the
 * provider, across the internet, into this same process, and back — several
 * times per question.
 *
 * Everything crossing this boundary is untrusted: tool names and arguments are
 * model output, not user input, but they are equally unvalidated. Dispatch
 * never throws — a bad name, malformed arguments or an unknown slug come back
 * as an error *result*, which the model can read and correct on its next turn.
 */
import type { AgentBundle, AgentTopicId } from "@ekoindia/eps-context-mcp/src/bundle-types.js";
import {
	getApi,
	getRecipe,
	getTopic,
	listRecipes,
	listTopics,
	searchApis,
} from "@ekoindia/eps-context-mcp/src/bundle-access.js";
import {
	SIGNING_LANGUAGES,
	getSigningSnippet,
} from "@ekoindia/eps-context-mcp/src/signing-snippets.js";

/**
 * Hard cap on a single tool result, in characters.
 *
 * A full API detail with every field populated is the large case, and the model
 * may pull several per turn across several turns. Without a cap one verbose
 * endpoint could crowd out the conversation or blow the context window.
 */
export const MAX_RESULT_CHARS = 12_000;

/** Hard cap on the JSON-encoded arguments the model may send to one tool. */
export const MAX_ARGS_CHARS = 2_000;

/** Cap on `search_apis` hits, so a broad query cannot return the whole bundle. */
const SEARCH_LIMIT = 8;

/** Provider-agnostic tool definition; each adapter renders it to its own shape. */
export interface ChatToolDef {
	name: string;
	description: string;
	/** JSON Schema (draft subset both providers accept). */
	inputSchema: {
		type: "object";
		properties: Record<string, unknown>;
		required?: string[];
		additionalProperties: false;
	};
}

/** Outcome of one dispatched call. */
export interface ToolResult {
	/** Text handed back to the model. Truncated to `MAX_RESULT_CHARS`. */
	content: string;
	/**
	 * Canonical citation id, set only when the call returned real content.
	 * A `search_apis` hit list is deliberately *not* a source: it proves the
	 * model looked, not that any of it informed the answer.
	 */
	sourceId?: string;
	isError: boolean;
}

const TOPIC_IDS: AgentTopicId[] = [
	"auth",
	"errors",
	"pricing",
	"environments",
	"getting-started",
];

/**
 * Tool descriptions are prescriptive about *when* to call, not just what the
 * tool does — that is what moves should-call rate on current models.
 */
export const CHAT_TOOLS: ChatToolDef[] = [
	{
		name: "search_apis",
		description:
			"Find EPS API endpoints by keyword. Call this first whenever the question names a capability (payouts, verification, KYC, balance) rather than a specific endpoint, then call get_api on the most relevant slug for the full details.",
		inputSchema: {
			type: "object",
			properties: {
				query: {
					type: "string",
					description: "Keywords, e.g. 'pan verification' or 'account payout'.",
				},
			},
			required: ["query"],
			additionalProperties: false,
		},
	},
	{
		name: "get_api",
		description:
			"Full detail for one EPS API endpoint: method, path, parameters, responses, and docs URL. Call this before describing any endpoint's request or response shape — never answer those from memory.",
		inputSchema: {
			type: "object",
			properties: {
				slug: {
					type: "string",
					description: "API slug, as returned by search_apis.",
				},
			},
			required: ["slug"],
			additionalProperties: false,
		},
	},
	{
		name: "get_topic",
		description: `Cross-cutting EPS reference. Call get_topic("auth") for ANY question touching authentication, signing, headers, keys or the secret-key computation — EPS signing is non-obvious and answers from memory are wrong. Available topics: ${TOPIC_IDS.join(", ")}.`,
		inputSchema: {
			type: "object",
			properties: {
				topic: { type: "string", enum: TOPIC_IDS as unknown as string[] },
			},
			required: ["topic"],
			additionalProperties: false,
		},
	},
	{
		name: "get_signing_snippet",
		description: `Ready-to-use backend signing code for one language (${SIGNING_LANGUAGES.join(", ")}). Call this when the user asks how to sign a request or wants code, in addition to get_topic("auth") for the explanation.`,
		inputSchema: {
			type: "object",
			properties: {
				language: {
					type: "string",
					enum: SIGNING_LANGUAGES as unknown as string[],
				},
			},
			required: ["language"],
			additionalProperties: false,
		},
	},
	{
		name: "list_recipes",
		description:
			"List multi-step EPS flows (recipes) by id and summary. Call when the question is about an end-to-end journey rather than a single endpoint, then get_recipe for the steps.",
		inputSchema: { type: "object", properties: {}, additionalProperties: false },
	},
	{
		name: "get_recipe",
		description:
			"The ordered steps of one EPS recipe, including which endpoint each step calls.",
		inputSchema: {
			type: "object",
			properties: {
				id: { type: "string", description: "Recipe id, from list_recipes." },
			},
			required: ["id"],
			additionalProperties: false,
		},
	},
];

const TOOL_NAMES = new Set(CHAT_TOOLS.map((t) => t.name));

/** Serialize a lookup result, truncating rather than letting it run unbounded. */
function render(value: unknown): string {
	const text = typeof value === "string" ? value : JSON.stringify(value, null, 0);
	if (text.length <= MAX_RESULT_CHARS) return text;
	return `${text.slice(0, MAX_RESULT_CHARS)}\n…[truncated: result exceeded ${MAX_RESULT_CHARS} characters]`;
}

const err = (message: string): ToolResult => ({
	content: `Error: ${message}`,
	isError: true,
});

/**
 * Runs one model-requested tool call against the bundle.
 *
 * @param bundle - the shared, TTL-refreshed agent bundle.
 * @param name - tool name as emitted by the model (untrusted).
 * @param rawArgs - arguments as emitted by the model: an object, or the raw
 *   JSON string some providers stream (untrusted, may be malformed).
 * @returns a result to feed back to the model. Never throws.
 */
export function dispatchTool(
	bundle: AgentBundle,
	name: string,
	rawArgs: unknown,
): ToolResult {
	if (!TOOL_NAMES.has(name)) {
		return err(`unknown tool "${name}". Available: ${[...TOOL_NAMES].join(", ")}.`);
	}

	let args: Record<string, unknown>;
	if (typeof rawArgs === "string") {
		if (rawArgs.length > MAX_ARGS_CHARS) return err("arguments too large.");
		try {
			args = JSON.parse(rawArgs || "{}") as Record<string, unknown>;
		} catch {
			return err("arguments were not valid JSON.");
		}
	} else if (rawArgs && typeof rawArgs === "object") {
		if (JSON.stringify(rawArgs).length > MAX_ARGS_CHARS) {
			return err("arguments too large.");
		}
		args = rawArgs as Record<string, unknown>;
	} else {
		args = {};
	}

	const str = (key: string): string | undefined => {
		const v = args[key];
		return typeof v === "string" && v.trim() ? v.trim() : undefined;
	};

	switch (name) {
		case "search_apis": {
			const query = str("query");
			if (!query) return err('"query" is required and must be a non-empty string.');
			const hits = searchApis(bundle, query, SEARCH_LIMIT);
			if (!hits.length) {
				return {
					content: `No endpoints matched "${query}". Try broader keywords, or call get_topic for cross-cutting subjects like auth or errors.`,
					isError: false,
				};
			}
			// Deliberately no sourceId: a hit list is navigation, not a citation.
			return { content: render(hits), isError: false };
		}
		case "get_api": {
			const slug = str("slug");
			if (!slug) return err('"slug" is required and must be a non-empty string.');
			const api = getApi(bundle, slug);
			if (!api) {
				return err(`no API with slug "${slug}". Use search_apis to find valid slugs.`);
			}
			return { content: render(api), sourceId: `api:${slug}`, isError: false };
		}
		case "get_topic": {
			const topic = str("topic");
			if (!topic) return err('"topic" is required.');
			if (!TOPIC_IDS.includes(topic as AgentTopicId)) {
				return err(`unknown topic "${topic}". Available: ${TOPIC_IDS.join(", ")}.`);
			}
			const body = getTopic(bundle, topic as AgentTopicId);
			if (body === undefined) return err(`topic "${topic}" is not in this bundle.`);
			return { content: render(body), sourceId: `topic:${topic}`, isError: false };
		}
		case "get_signing_snippet": {
			const language = str("language");
			if (!language) return err('"language" is required.');
			if (!(SIGNING_LANGUAGES as readonly string[]).includes(language)) {
				return err(
					`unsupported language "${language}". Supported: ${SIGNING_LANGUAGES.join(", ")}.`,
				);
			}
			return {
				content: render(getSigningSnippet(language)),
				sourceId: `signing:${language}`,
				isError: false,
			};
		}
		case "list_recipes": {
			const recipes = listRecipes(bundle);
			if (!recipes.length) {
				return { content: "No recipes in this bundle.", isError: false };
			}
			return { content: render(recipes), isError: false };
		}
		case "get_recipe": {
			const id = str("id");
			if (!id) return err('"id" is required and must be a non-empty string.');
			const recipe = getRecipe(bundle, id);
			if (!recipe) {
				return err(`no recipe with id "${id}". Use list_recipes to find valid ids.`);
			}
			return { content: render(recipe), sourceId: `recipe:${id}`, isError: false };
		}
		default:
			// Unreachable: TOOL_NAMES is derived from the same switch arms.
			return err(`tool "${name}" has no dispatcher.`);
	}
}

/** Topic ids exposed to the model; also the enum the schema validates against. */
export { TOPIC_IDS, listTopics };
