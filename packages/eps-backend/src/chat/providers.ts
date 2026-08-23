/**
 * LLM provider adapters for the docs-chat route.
 *
 * Two adapters cover the three supported providers: `anthropic` speaks the
 * Messages API, and `openai-compatible` speaks Chat Completions, which covers
 * OpenAI and OpenRouter (a base-URL swap, same schema). Both are plain `fetch`
 * — an SDK would add a dependency to buy back nothing, since the chat route
 * needs exactly one endpoint and drives its own loop.
 *
 * The conversation is held in a **neutral** shape (`ProviderMessage`) and each
 * adapter renders it on the way out. Tool-call plumbing is the only part of
 * the two wire formats that genuinely differs, and keeping the loop free of
 * that difference is what lets the route stay provider-agnostic.
 */
import { AppError } from "../http/errors";
import type { ChatToolDef } from "./tools";

/** A tool invocation the model asked for. */
export interface ToolCall {
	/** Provider-assigned id; the tool result must quote it back. */
	id: string;
	name: string;
	/** Object or raw JSON string, depending on provider. Untrusted either way. */
	args: unknown;
}

/** Neutral conversation record. Adapters render this to their own wire shape. */
export type ProviderMessage =
	| { role: "user"; text: string }
	| { role: "assistant"; text: string; toolCalls?: ToolCall[] }
	| {
			role: "tool";
			callId: string;
			name: string;
			content: string;
			isError: boolean;
	  };

export interface ProviderReply {
	text: string;
	toolCalls: ToolCall[];
	usage: { inputTokens: number; outputTokens: number };
}

export interface CompleteRequest {
	system: string;
	messages: ProviderMessage[];
	tools: ChatToolDef[];
	maxTokens: number;
	/**
	 * False on the forced final turn, when the loop has spent its iteration
	 * budget and needs prose rather than another tool call.
	 */
	allowTools: boolean;
	/** End-to-end deadline for the whole request, shared by every call. */
	signal: AbortSignal;
}

export interface ChatProvider {
	complete(req: CompleteRequest): Promise<ProviderReply>;
}

export interface ProviderConfig {
	provider: "anthropic" | "openai" | "openrouter";
	model: string;
	apiKey: string;
	/** Overrides the provider default (self-host, gateway, OpenRouter). */
	baseUrl?: string;
	fetchImpl?: typeof fetch;
}

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Provider failures are one externally-visible outcome, whatever their shape.
 *
 * The body is deliberately not forwarded: it can carry provider-side prompt
 * echoes, and it is read by a browser. `cause` keeps the detail for the logs.
 */
function upstream(detail: string, cause?: unknown): AppError {
	const e = new AppError(502, "UPSTREAM_ERROR", "AI provider request failed");
	// Keep BOTH the classification and the raw failure. `cause` is log-only —
	// `errorBody` emits code/message/details and never touches it — so this is
	// where "deadline exceeded" vs "network error" survives for the operator.
	(e as { cause?: unknown }).cause = { detail, cause };
	return e;
}

/** Distinguishes "we ran out of time" from "the provider said no". */
function isAbort(err: unknown): boolean {
	return (
		err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError")
	);
}

async function postJson(
	fetchImpl: typeof fetch,
	url: string,
	headers: Record<string, string>,
	body: unknown,
	signal: AbortSignal,
): Promise<unknown> {
	let res: Response;
	try {
		res = await fetchImpl(url, {
			method: "POST",
			headers: { "content-type": "application/json", ...headers },
			body: JSON.stringify(body),
			signal,
		});
	} catch (err) {
		throw upstream(isAbort(err) ? "deadline exceeded" : "network error", err);
	}
	if (!res.ok) {
		// Read defensively: an error body may be HTML from a proxy, not JSON.
		let snippet = "";
		try {
			snippet = (await res.text()).slice(0, 500);
		} catch {
			snippet = "<unreadable>";
		}
		throw upstream(`http ${res.status}`, snippet);
	}
	try {
		return await res.json();
	} catch (err) {
		throw upstream("response was not valid JSON", err);
	}
}

/** Anthropic Messages API. */
function anthropicProvider(cfg: ProviderConfig): ChatProvider {
	const fetchImpl = cfg.fetchImpl ?? fetch;
	const url = cfg.baseUrl ?? ANTHROPIC_URL;

	return {
		async complete(req) {
			// Anthropic groups consecutive tool results into ONE user turn; a
			// separate message per result is rejected and, on models that accept
			// it, trains the model out of parallel tool calls.
			const messages: unknown[] = [];
			let pendingResults: unknown[] = [];
			const flush = () => {
				if (pendingResults.length) {
					messages.push({ role: "user", content: pendingResults });
					pendingResults = [];
				}
			};
			for (const m of req.messages) {
				if (m.role === "tool") {
					pendingResults.push({
						type: "tool_result",
						tool_use_id: m.callId,
						content: m.content,
						...(m.isError ? { is_error: true } : {}),
					});
					continue;
				}
				flush();
				if (m.role === "user") {
					messages.push({ role: "user", content: m.text });
				} else {
					const content: unknown[] = [];
					if (m.text) content.push({ type: "text", text: m.text });
					for (const c of m.toolCalls ?? []) {
						content.push({
							type: "tool_use",
							id: c.id,
							name: c.name,
							input: typeof c.args === "string" ? JSON.parse(c.args || "{}") : c.args,
						});
					}
					messages.push({ role: "assistant", content });
				}
			}
			flush();

			const body = await postJson(
				fetchImpl,
				url,
				{ "x-api-key": cfg.apiKey, "anthropic-version": "2023-06-01" },
				{
					model: cfg.model,
					max_tokens: req.maxTokens,
					system: req.system,
					messages,
					tools: req.tools.map((t) => ({
						name: t.name,
						description: t.description,
						input_schema: t.inputSchema,
					})),
					// Keep the tool list stable across turns (removing it mid-conversation
					// invalidates the cached prefix) and gate use with tool_choice instead.
					...(req.allowTools ? {} : { tool_choice: { type: "none" } }),
				},
				req.signal,
			);

			const parsed = body as {
				content?: { type: string; text?: string; id?: string; name?: string; input?: unknown }[];
				usage?: { input_tokens?: number; output_tokens?: number };
			};
			if (!Array.isArray(parsed.content)) {
				throw upstream("response had no content array");
			}
			const text = parsed.content
				.filter((b) => b.type === "text" && typeof b.text === "string")
				.map((b) => b.text as string)
				.join("");
			const toolCalls: ToolCall[] = parsed.content
				.filter((b) => b.type === "tool_use" && b.id && b.name)
				.map((b) => ({ id: b.id as string, name: b.name as string, args: b.input }));

			return {
				text,
				toolCalls,
				usage: {
					inputTokens: parsed.usage?.input_tokens ?? 0,
					outputTokens: parsed.usage?.output_tokens ?? 0,
				},
			};
		},
	};
}

/** OpenAI Chat Completions schema; also covers OpenRouter. */
function openAiCompatibleProvider(cfg: ProviderConfig): ChatProvider {
	const fetchImpl = cfg.fetchImpl ?? fetch;
	const url =
		cfg.baseUrl ?? (cfg.provider === "openrouter" ? OPENROUTER_URL : OPENAI_URL);

	return {
		async complete(req) {
			const messages: unknown[] = [{ role: "system", content: req.system }];
			for (const m of req.messages) {
				if (m.role === "user") {
					messages.push({ role: "user", content: m.text });
				} else if (m.role === "assistant") {
					messages.push({
						role: "assistant",
						content: m.text || null,
						...(m.toolCalls?.length
							? {
									tool_calls: m.toolCalls.map((c) => ({
										id: c.id,
										type: "function",
										function: {
											name: c.name,
											arguments:
												typeof c.args === "string" ? c.args : JSON.stringify(c.args ?? {}),
										},
									})),
								}
							: {}),
					});
				} else {
					// Unlike Anthropic, each result is its own message.
					messages.push({
						role: "tool",
						tool_call_id: m.callId,
						content: m.content,
					});
				}
			}

			const body = await postJson(
				fetchImpl,
				url,
				{ authorization: `Bearer ${cfg.apiKey}` },
				{
					model: cfg.model,
					max_tokens: req.maxTokens,
					messages,
					tools: req.tools.map((t) => ({
						type: "function",
						function: {
							name: t.name,
							description: t.description,
							parameters: t.inputSchema,
						},
					})),
					tool_choice: req.allowTools ? "auto" : "none",
				},
				req.signal,
			);

			const parsed = body as {
				choices?: {
					message?: {
						content?: string | null;
						tool_calls?: {
							id?: string;
							function?: { name?: string; arguments?: string };
						}[];
					};
				}[];
				usage?: { prompt_tokens?: number; completion_tokens?: number };
			};
			const message = parsed.choices?.[0]?.message;
			if (!message) throw upstream("response had no choices");

			const toolCalls: ToolCall[] = (message.tool_calls ?? [])
				.filter((c) => c.id && c.function?.name)
				.map((c) => ({
					id: c.id as string,
					name: c.function?.name as string,
					args: c.function?.arguments ?? "{}",
				}));

			return {
				text: message.content ?? "",
				toolCalls,
				usage: {
					inputTokens: parsed.usage?.prompt_tokens ?? 0,
					outputTokens: parsed.usage?.completion_tokens ?? 0,
				},
			};
		},
	};
}

/**
 * Builds the configured provider adapter.
 *
 * @param cfg - provider selection, model, key, and an optional fetch seam.
 */
export function createChatProvider(cfg: ProviderConfig): ChatProvider {
	return cfg.provider === "anthropic"
		? anthropicProvider(cfg)
		: openAiCompatibleProvider(cfg);
}
