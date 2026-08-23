import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import type { SecurityRecord } from "../audit/securityLog";
import { createSecurityLogger } from "../audit/securityLog";
import type { Sessions } from "../auth/session";
import { ACCESS_COOKIE } from "../auth/session";
import type { ChatProvider, ProviderReply } from "../chat/providers";
import type { SpendTracker } from "../chat/spend";
import type { ContextBundleManager } from "../context/bundleManager";
import type { AgentBundle } from "@ekoindia/eps-context-mcp/src/bundle-types.js";
import { createInMemoryKV } from "../store/kv";
import type { KV } from "../store/kv";
import { MAX_BODY_BYTES, MAX_MESSAGES, mountChat, parseAskBody } from "./chat";
import { AppError, errorBody } from "./errors";
import type { AppEnv } from "./requestId";

const bundle = {
	meta: { org: "ekoindia", apiVersion: "v3", bundleVersion: "t", environments: [] },
	topics: { auth: { summary: "secret-key = base64(HMAC-SHA256(ts, base64(ak)))" } },
	apis: [
		{
			slug: "pan-verify",
			productId: "verify",
			productName: "Verification",
			name: "PAN",
			method: "POST",
			path: "/pan",
			summary: "Verify a PAN",
			category: "verification",
			docsUrl: "https://eps.eko.in/docs/pan-verify",
		},
	],
	recipes: [],
} as unknown as AgentBundle;

const bundles = (loaded = true): ContextBundleManager => ({
	bundle,
	ensureFresh: () => {},
	isLoaded: () => loaded,
});

const sessions = (claim: unknown): Sessions =>
	({ verifyAccess: async () => claim }) as unknown as Sessions;

const spendOk: SpendTracker = {
	isExhausted: async () => false,
	record: async () => {},
};

/** A provider that replays a scripted sequence of replies. */
function scripted(...replies: Partial<ProviderReply>[]): {
	provider: ChatProvider;
	seen: { allowTools: boolean; messageCount: number }[];
} {
	const seen: { allowTools: boolean; messageCount: number }[] = [];
	let i = 0;
	const provider: ChatProvider = {
		async complete(req) {
			seen.push({ allowTools: req.allowTools, messageCount: req.messages.length });
			const r = replies[Math.min(i++, replies.length - 1)];
			return {
				text: r.text ?? "",
				toolCalls: r.toolCalls ?? [],
				usage: r.usage ?? { inputTokens: 10, outputTokens: 5 },
			};
		},
	};
	return { provider, seen };
}

function harness(over: {
	claim?: unknown;
	provider?: ChatProvider;
	spend?: SpendTracker;
	kv?: KV;
	loaded?: boolean;
	engine?: false;
	sink?: (line: string) => void;
}) {
	const app = new Hono<AppEnv>();
	app.use("*", async (c, next) => {
		c.set("rid", "rid-test");
		await next();
	});
	mountChat(app, {
		sessions: sessions(
			over.claim === undefined ? { sub: "9990000000", role: "developer" } : over.claim,
		),
		kv: over.kv ?? createInMemoryKV(),
		securityLog: createSecurityLogger({ sink: over.sink ?? (() => {}) }),
		engine:
			over.engine === false
				? undefined
				: {
						bundles: bundles(over.loaded ?? true),
						provider: over.provider ?? scripted({ text: "hi" }).provider,
						spend: over.spend ?? spendOk,
					},
	});
	app.onError((err, c) => {
		if (err instanceof AppError) {
			return c.json(errorBody(err.code, err.message), err.status as 400);
		}
		return c.json(errorBody("INTERNAL", "boom"), 500);
	});
	return app;
}

const ask = (app: Hono<AppEnv>, body: unknown, cookie = `${ACCESS_COOKIE}=t`) =>
	app.request("/chat/ask", {
		method: "POST",
		headers: { "content-type": "application/json", cookie },
		body: typeof body === "string" ? body : JSON.stringify(body),
	});

const one = [{ role: "user", content: "how do I sign a request?" }];

interface AskOk {
	answer: string;
	sources: string[];
	usage: { inputTokens: number; outputTokens: number };
}
interface AskErr {
	error: { code: string; message: string };
}

/** `Response.json()` is `unknown`; name the shape once instead of per call. */
const jsonOf = async <T>(res: Response): Promise<T> => (await res.json()) as T;

describe("parseAskBody", () => {
	it("accepts a well-formed alternating history ending on the user", () => {
		const parsed = parseAskBody({
			messages: [
				{ role: "user", content: "a" },
				{ role: "assistant", content: "b" },
				{ role: "user", content: "c" },
			],
		});
		expect(parsed.messages).toHaveLength(3);
	});

	const rejects = (body: unknown, why: string) =>
		it(`rejects ${why}`, () => {
			expect(() => parseAskBody(body)).toThrowError(AppError);
		});

	rejects({}, "a missing messages array");
	rejects({ messages: [] }, "an empty history");
	rejects({ messages: Array.from({ length: MAX_MESSAGES + 1 }, () => ({ role: "user", content: "x" })) }, "more messages than the cap");
	rejects({ messages: [{ role: "system", content: "x" }] }, "an unsupported role");
	rejects({ messages: [{ role: "user", content: "   " }] }, "whitespace-only content");
	rejects({ messages: [{ role: "user", content: "x".repeat(4001) }] }, "an over-long message");
	rejects({ messages: [{ role: "user", content: "x", tool_calls: [] }] }, "an unknown field");
	rejects(
		{ messages: [{ role: "user", content: "a" }, { role: "user", content: "b" }] },
		"a non-alternating history",
	);
	rejects(
		{ messages: [{ role: "user", content: "a" }, { role: "assistant", content: "b" }] },
		"a history ending on the assistant",
	);
});

describe("POST /chat/ask — the gate", () => {
	it("401s with no session", async () => {
		const res = await ask(harness({ claim: null }), { messages: one }, "");
		expect(res.status).toBe(401);
	});

	it("403s a signup-role session — mid-onboarding is not a developer", async () => {
		const res = await ask(
			harness({ claim: { sub: "1", role: "signup" } }),
			{ messages: one },
		);
		expect(res.status).toBe(403);
		expect((await jsonOf<AskErr>(res)).error.code).toBe("NOT_DEVELOPER_SESSION");
	});

	it("allows an admin session — admins are staff, not outsiders", async () => {
		const res = await ask(harness({ claim: { sub: "1", role: "admin" } }), {
			messages: one,
		});
		expect(res.status).toBe(200);
	});

	it("503 CHAT_DISABLED when no provider is configured", async () => {
		const res = await ask(harness({ engine: false }), { messages: one });
		expect(res.status).toBe(503);
		expect((await jsonOf<AskErr>(res)).error.code).toBe("CHAT_DISABLED");
	});

	it("503 CHAT_BUNDLE_UNAVAILABLE before the first bundle load", async () => {
		const res = await ask(harness({ loaded: false }), { messages: one });
		expect(res.status).toBe(503);
		expect((await jsonOf<AskErr>(res)).error.code).toBe("CHAT_BUNDLE_UNAVAILABLE");
	});

	it("503 CHAT_BUDGET_EXHAUSTED when the month is spent", async () => {
		const res = await ask(
			harness({ spend: { isExhausted: async () => true, record: async () => {} } }),
			{ messages: one },
		);
		expect(res.status).toBe(503);
		expect((await jsonOf<AskErr>(res)).error.code).toBe("CHAT_BUDGET_EXHAUSTED");
	});

	it("429s past the per-login request limit", async () => {
		const app = harness({});
		for (let i = 0; i < 30; i++) {
			expect((await ask(app, { messages: one })).status).toBe(200);
		}
		const res = await ask(app, { messages: one });
		expect(res.status).toBe(429);
	});

	it("rejects an oversized body before parsing it", async () => {
		const huge = JSON.stringify({
			messages: [{ role: "user", content: "x".repeat(MAX_BODY_BYTES) }],
		});
		const res = await ask(harness({}), huge);
		expect(res.status).toBe(400);
	});

	it("rejects a body that is not JSON at all", async () => {
		const res = await ask(harness({}), "{{{");
		expect(res.status).toBe(400);
	});
});

describe("POST /chat/ask — the tool loop", () => {
	it("dispatches a tool call in-process and answers from the result", async () => {
		const { provider, seen } = scripted(
			{ toolCalls: [{ id: "c1", name: "get_topic", args: { topic: "auth" } }] },
			{ text: "Use base64(HMAC-SHA256(...))." },
		);
		const res = await ask(harness({ provider }), { messages: one });

		expect(res.status).toBe(200);
		const body = await jsonOf<AskOk>(res);
		expect(body.answer).toContain("HMAC");
		expect(body.sources).toEqual(["topic:auth"]);
		// Round 2 saw the assistant turn + the tool result appended.
		expect(seen[1].messageCount).toBe(3);
	});

	it("sums usage across every round, not just the last", async () => {
		const { provider } = scripted(
			{
				toolCalls: [{ id: "c1", name: "get_topic", args: { topic: "auth" } }],
				usage: { inputTokens: 100, outputTokens: 20 },
			},
			{ text: "done", usage: { inputTokens: 300, outputTokens: 40 } },
		);
		const body = await jsonOf<AskOk>(await ask(harness({ provider }), { messages: one }));
		expect(body.usage).toEqual({ inputTokens: 400, outputTokens: 60 });
	});

	it("does not cite a search that only produced a hit list", async () => {
		const { provider } = scripted(
			{ toolCalls: [{ id: "c1", name: "search_apis", args: { query: "pan" } }] },
			{ text: "There is a PAN endpoint." },
		);
		const body = await jsonOf<AskOk>(await ask(harness({ provider }), { messages: one }));
		expect(body.sources).toEqual([]);
	});

	it("suppresses an identical repeat call instead of dispatching twice", async () => {
		const call = { id: "c1", name: "get_topic", args: { topic: "auth" } };
		const { provider } = scripted(
			{ toolCalls: [call] },
			{ toolCalls: [{ ...call, id: "c2" }] },
			{ text: "done" },
		);
		const body = await jsonOf<AskOk>(await ask(harness({ provider }), { messages: one }));
		// Deduped: the source appears once, not twice.
		expect(body.sources).toEqual(["topic:auth"]);
		expect(body.answer).toBe("done");
	});

	it("feeds a bad tool call back as an error result so the model can recover", async () => {
		const { provider } = scripted(
			{ toolCalls: [{ id: "c1", name: "get_api", args: { slug: "nope" } }] },
			{ text: "I could not find that endpoint." },
		);
		const res = await ask(harness({ provider }), { messages: one });
		expect(res.status).toBe(200);
		expect((await jsonOf<AskOk>(res)).sources).toEqual([]);
	});

	it("stops the loop by forcing a final tool-free turn, never a dangling call", async () => {
		// A provider that always wants another tool call.
		const { provider, seen } = scripted({
			toolCalls: [{ id: "c", name: "get_topic", args: { topic: "auth" } }],
			text: "",
		});
		const looping: ChatProvider = {
			async complete(req) {
				const r = await provider.complete(req);
				// On the forced final turn the loop must ask for prose.
				return req.allowTools ? r : { ...r, toolCalls: [], text: "final answer" };
			},
		};
		const res = await ask(harness({ provider: looping }), { messages: one });

		expect(res.status).toBe(200);
		expect((await jsonOf<AskOk>(res)).answer).toBe("final answer");
		expect(seen.at(-1)?.allowTools).toBe(false);
	});

	it("502s rather than returning an empty answer as success", async () => {
		const { provider } = scripted({ text: "   " });
		const res = await ask(harness({ provider }), { messages: one });
		expect(res.status).toBe(502);
	});
});

describe("POST /chat/ask — audit records carry no message content", () => {
	const records = (lines: string[]): SecurityRecord[] =>
		lines.map((l) => JSON.parse(l) as SecurityRecord);

	it("logs a denial with rid + code and a null actor when unauthenticated", async () => {
		const lines: string[] = [];
		await ask(harness({ claim: null, sink: (l) => lines.push(l) }), { messages: one }, "");
		const [rec] = records(lines);
		expect(rec.event).toBe("chat_denied");
		expect(rec.actor).toBeNull();
		expect(rec.reason).toBe("NO_SESSION");
		expect(rec.rid).toBe("rid-test");
	});

	it("never writes the user's words into the audit log, on any denial path", async () => {
		// A distinctive phrase, not a key-shaped token: the assertion only needs
		// something unmistakably the user's, and a credential-looking literal
		// here trips secret scanners for no benefit.
		const userWords = "please check my onboarding paperwork";
		const lines: string[] = [];
		const sink = (l: string) => lines.push(l);

		await ask(harness({ engine: false, sink }), {
			messages: [{ role: "user", content: userWords }],
		});
		await ask(harness({ claim: { sub: "1", role: "signup" }, sink }), {
			messages: [{ role: "user", content: userWords }],
		});
		await ask(harness({ sink }), { messages: [{ role: "user", content: "x".repeat(9999) }] });

		expect(lines.length).toBeGreaterThan(0);
		for (const line of lines) expect(line).not.toContain(userWords);
		for (const rec of records(lines)) expect(rec.actor === null || typeof rec.actor === "string").toBe(true);
	});
});

describe("privilege isolation", () => {
	it("chat.ts imports nothing from github or admin", () => {
		const src = readFileSync(new URL("./chat.ts", import.meta.url), "utf8");
		const imports = src.match(/^import .*$/gm) ?? [];
		for (const line of imports) {
			expect(line.toLowerCase()).not.toContain("github");
			expect(line).not.toContain("admin");
		}
	});
});
