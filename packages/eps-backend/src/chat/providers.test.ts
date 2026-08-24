import { describe, expect, it } from "vitest";
import { AppError } from "../http/errors";
import { createChatProvider, type ProviderMessage } from "./providers";
import { CHAT_TOOLS } from "./tools";

const never = new AbortController().signal;

const base = {
	system: "sys",
	tools: CHAT_TOOLS,
	maxTokens: 1000,
	allowTools: true,
	signal: never,
};

const jsonRes = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});

/** Shape of an outgoing wire payload, as far as these assertions care. */
interface SentBody {
	model: string;
	messages: { role: string; content: unknown; tool_calls?: unknown[] }[];
	tools: Record<string, unknown>[];
	tool_choice?: unknown;
}

interface SentCall {
	url: string;
	headers: Record<string, string>;
	body: SentBody;
}

/** Captures the outgoing request so shape assertions read the real payload. */
function capture(response: Response) {
	const calls: SentCall[] = [];
	const fetchImpl = async (
		url: string | URL | Request,
		init?: RequestInit,
	): Promise<Response> => {
		calls.push({
			url: String(url),
			headers: (init?.headers ?? {}) as Record<string, string>,
			body: JSON.parse(String(init?.body)) as SentBody,
		});
		return response.clone();
	};
	return { calls, fetchImpl: fetchImpl as typeof fetch };
}

/** A fetch stand-in for the failure cases, which never inspect the request. */
const failWith = (fn: () => Promise<Response>): typeof fetch =>
	(() => fn()) as unknown as typeof fetch;

const anthropicOk = jsonRes({
	content: [
		{ type: "text", text: "hello" },
		{ type: "tool_use", id: "tu_1", name: "get_api", input: { slug: "pan-verify" } },
	],
	usage: { input_tokens: 11, output_tokens: 22 },
});

const openAiOk = jsonRes({
	choices: [
		{
			message: {
				content: "hello",
				tool_calls: [
					{
						id: "call_1",
						type: "function",
						function: { name: "get_api", arguments: '{"slug":"pan-verify"}' },
					},
				],
			},
		},
	],
	usage: { prompt_tokens: 11, completion_tokens: 22 },
});

describe("anthropic adapter", () => {
	const cfgOf = (fetchImpl: typeof fetch) =>
		({ provider: "anthropic", model: "claude-haiku-4-5", apiKey: "k", fetchImpl }) as const;

	it("sends the key + version headers and parses text, tool calls and usage", async () => {
		const { calls, fetchImpl } = capture(anthropicOk);
		const reply = await createChatProvider(cfgOf(fetchImpl)).complete({
			...base,
			messages: [{ role: "user", text: "hi" }],
		});

		expect(calls[0].headers["x-api-key"]).toBe("k");
		expect(calls[0].headers["anthropic-version"]).toBe("2023-06-01");
		expect(calls[0].body.tools[0]).toHaveProperty("input_schema");
		expect(reply.text).toBe("hello");
		expect(reply.toolCalls).toEqual([
			{ id: "tu_1", name: "get_api", args: { slug: "pan-verify" } },
		]);
		expect(reply.usage).toEqual({ inputTokens: 11, outputTokens: 22 });
	});

	it("groups consecutive tool results into ONE user turn", async () => {
		const { calls, fetchImpl } = capture(anthropicOk);
		const messages: ProviderMessage[] = [
			{ role: "user", text: "hi" },
			{
				role: "assistant",
				text: "",
				toolCalls: [
					{ id: "a", name: "get_api", args: {} },
					{ id: "b", name: "get_topic", args: {} },
				],
			},
			{ role: "tool", callId: "a", name: "get_api", content: "A", isError: false },
			{ role: "tool", callId: "b", name: "get_topic", content: "B", isError: false },
		];
		await createChatProvider(cfgOf(fetchImpl)).complete({ ...base, messages });

		const sent = calls[0].body.messages;
		const results = sent.filter(
			(m) => m.role === "user" && Array.isArray(m.content),
		);
		expect(results).toHaveLength(1);
		expect(results[0].content as unknown[]).toHaveLength(2);
	});

	it("marks an error result so the model can correct itself", async () => {
		const { calls, fetchImpl } = capture(anthropicOk);
		await createChatProvider(cfgOf(fetchImpl)).complete({
			...base,
			messages: [
				{ role: "user", text: "hi" },
				{ role: "assistant", text: "", toolCalls: [{ id: "a", name: "get_api", args: {} }] },
				{ role: "tool", callId: "a", name: "get_api", content: "Error: nope", isError: true },
			],
		});
		const block = (calls[0].body.messages.at(-1)?.content as {
			is_error?: boolean;
		}[])[0];
		expect(block.is_error).toBe(true);
	});

	it("disables tools on the forced final turn without removing them", async () => {
		const { calls, fetchImpl } = capture(anthropicOk);
		await createChatProvider(cfgOf(fetchImpl)).complete({
			...base,
			allowTools: false,
			messages: [{ role: "user", text: "hi" }],
		});
		// Tools stay in the payload: dropping them mid-conversation would
		// invalidate the cached prefix.
		expect(calls[0].body.tools.length).toBeGreaterThan(0);
		expect(calls[0].body.tool_choice).toEqual({ type: "none" });
	});
});

describe("openai-compatible adapter", () => {
	const cfgOf = (fetchImpl: typeof fetch, provider: "openai" | "openrouter" = "openai") =>
		({ provider, model: "gpt-x", apiKey: "k", fetchImpl }) as const;

	it("sends a bearer token and parses tool_calls and usage", async () => {
		const { calls, fetchImpl } = capture(openAiOk);
		const reply = await createChatProvider(cfgOf(fetchImpl)).complete({
			...base,
			messages: [{ role: "user", text: "hi" }],
		});

		expect(calls[0].headers.authorization).toBe("Bearer k");
		expect(calls[0].body.tools[0].type).toBe("function");
		expect(reply.toolCalls[0]).toEqual({
			id: "call_1",
			name: "get_api",
			args: '{"slug":"pan-verify"}',
		});
		expect(reply.usage).toEqual({ inputTokens: 11, outputTokens: 22 });
	});

	it("routes openrouter to its own base URL", async () => {
		const { calls, fetchImpl } = capture(openAiOk);
		await createChatProvider(cfgOf(fetchImpl, "openrouter")).complete({
			...base,
			messages: [{ role: "user", text: "hi" }],
		});
		expect(calls[0].url).toContain("openrouter.ai");
	});

	it("emits one tool message per result, as this schema requires", async () => {
		const { calls, fetchImpl } = capture(openAiOk);
		await createChatProvider(cfgOf(fetchImpl)).complete({
			...base,
			messages: [
				{ role: "user", text: "hi" },
				{
					role: "assistant",
					text: "",
					toolCalls: [
						{ id: "a", name: "get_api", args: {} },
						{ id: "b", name: "get_topic", args: {} },
					],
				},
				{ role: "tool", callId: "a", name: "get_api", content: "A", isError: false },
				{ role: "tool", callId: "b", name: "get_topic", content: "B", isError: false },
			],
		});
		const toolMsgs = calls[0].body.messages.filter((m) => m.role === "tool");
		expect(toolMsgs).toHaveLength(2);
	});
});

describe("failure modes map to one 502, and never leak the provider body", () => {
	const cfgOf = (fetchImpl: typeof fetch) =>
		({ provider: "anthropic", model: "m", apiKey: "sk-secret", fetchImpl }) as const;

	const expectUpstream = async (fetchImpl: typeof fetch) => {
		const p = createChatProvider(cfgOf(fetchImpl));
		const err = await p
			.complete({ ...base, messages: [{ role: "user", text: "hi" }] })
			.catch((e) => e);
		expect(err).toBeInstanceOf(AppError);
		expect((err as AppError).status).toBe(502);
		expect((err as AppError).code).toBe("UPSTREAM_ERROR");
		// The client-visible message must not echo provider internals or the key.
		expect((err as AppError).message).not.toContain("sk-secret");
		return err as AppError;
	};

	it("provider 5xx", async () => {
		await expectUpstream(failWith(async () => jsonRes({ error: "boom" }, 500)));
	});

	it("provider 4xx with a non-JSON (HTML proxy) body", async () => {
		await expectUpstream(
			failWith(async () => new Response("<html>gateway</html>", { status: 429 })),
		);
	});

	it("200 with a body that is not JSON", async () => {
		await expectUpstream(
			failWith(
				async () =>
					new Response("not json", {
						status: 200,
						headers: { "content-type": "application/json" },
					}),
			),
		);
	});

	it("200 with a well-formed but empty/unexpected shape", async () => {
		await expectUpstream(failWith(async () => jsonRes({})));
	});

	it("network failure", async () => {
		await expectUpstream(
			failWith(async () => {
				throw new Error("ECONNREFUSED");
			}),
		);
	});

	it("deadline exceeded (abort)", async () => {
		const err = await expectUpstream(
			failWith(async () => {
				const e = new Error("aborted");
				e.name = "AbortError";
				throw e;
			}),
		);
		expect((err as { cause?: { detail?: string } }).cause?.detail).toBe(
			"deadline exceeded",
		);
	});
});
