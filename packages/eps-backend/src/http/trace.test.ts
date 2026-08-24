import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "./app";
import { loadConfig } from "../config";
import { createInMemoryKV } from "../store/kv";
import { createSessions } from "../auth/session";
import type { EkoClient } from "../clients/eko";
import { requestId, type AppEnv } from "./requestId";
import {
	clamp,
	currentRid,
	debugEcho,
	DEBUG_HEADER,
	markAuthenticated,
	recordUpstream,
	trace,
	traceForResponse,
	type UpstreamCall,
} from "./trace";

/** A recorded call with only the field under test varied. */
function call(over: Partial<UpstreamCall> = {}): UpstreamCall {
	return {
		path: "/interactions",
		clientRefId: "ref-1",
		status: 200,
		durMs: 12,
		error: null,
		...over,
	};
}

/**
 * Runs `body` inside a real request scope, since every accessor is a no-op
 * outside one.
 */
async function inRequest<T>(body: () => T | Promise<T>): Promise<T> {
	let out: T | undefined;
	const app = new Hono<AppEnv>();
	app.use("*", requestId());
	app.use("*", trace());
	app.get("/", async (c) => {
		out = await body();
		return c.json({ ok: true });
	});
	await app.request("/");
	return out as T;
}

describe("clamp", () => {
	it("passes a small value through untouched", () => {
		expect(clamp({ a: 1, b: "hi" })).toEqual([{ a: 1, b: "hi" }, false]);
	});

	it("truncates a long string and says so", () => {
		const [out, truncated] = clamp({ s: "x".repeat(1_200) });
		expect(truncated).toBe(true);
		expect((out as { s: string }).s).toMatch(/…\[truncated\]$/);
		expect((out as { s: string }).s.length).toBe(1_000 + "…[truncated]".length);
	});

	it("caps array width", () => {
		const [out, truncated] = clamp(Array.from({ length: 50 }, (_, i) => i));
		expect(truncated).toBe(true);
		expect(out).toHaveLength(20);
	});

	it("caps nesting depth", () => {
		let deep: unknown = "bottom";
		for (let i = 0; i < 10; i++) deep = { next: deep };
		const [out, truncated] = clamp(deep);
		expect(truncated).toBe(true);
		expect(JSON.stringify(out)).toContain("[depth limit]");
	});

	it("cuts a cycle instead of blowing the stack", () => {
		const a: Record<string, unknown> = { name: "a" };
		a.self = a;
		const [out, truncated] = clamp(a);
		expect(truncated).toBe(true);
		expect(out).toEqual({ name: "a", self: "[circular]" });
	});

	// The `seen` set tracks the current path only, so a shared sibling is real
	// data rather than a loop.
	it("keeps a repeated sibling that is not a cycle", () => {
		const shared = { id: 7 };
		const [out, truncated] = clamp({ left: shared, right: shared });
		expect(truncated).toBe(false);
		expect(out).toEqual({ left: { id: 7 }, right: { id: 7 } });
	});

	it("replaces a body that is over the byte cap", () => {
		const [out, truncated] = clamp({ blob: ["y".repeat(900)].concat(
			Array.from({ length: 19 }, () => "z".repeat(900)),
		) });
		expect(truncated).toBe(true);
		expect(out).toMatchObject({ note: "[response too large]" });
	});

	it("replaces a body that cannot be serialized", () => {
		const [out, truncated] = clamp({ big: 1n });
		expect(truncated).toBe(true);
		expect(out).toEqual({ note: "[unserializable response]" });
	});
});

describe("trace scope", () => {
	it("records calls and exposes the owning rid", async () => {
		const seen = await inRequest(() => {
			recordUpstream(call());
			recordUpstream(call({ clientRefId: "ref-2" }));
			return { rid: currentRid(), calls: traceForResponse() };
		});
		expect(seen.rid).toBeTruthy();
		expect(seen.calls.map((c) => c.clientRefId)).toEqual(["ref-1", "ref-2"]);
	});

	it("stops recording past the cap so a retry loop cannot grow the body", async () => {
		const calls = await inRequest(() => {
			for (let i = 0; i < 25; i++) recordUpstream(call());
			return traceForResponse();
		});
		expect(calls).toHaveLength(10);
	});

	it("is a no-op outside a request", () => {
		expect(() => recordUpstream(call())).not.toThrow();
		expect(() => markAuthenticated()).not.toThrow();
		expect(currentRid()).toBeNull();
		expect(traceForResponse()).toEqual([]);
	});

	it("scopes are independent between requests", async () => {
		await inRequest(() => recordUpstream(call()));
		expect(await inRequest(() => traceForResponse())).toEqual([]);
	});
});

describe("response gating", () => {
	it("withholds response bodies from an anonymous caller", async () => {
		const calls = await inRequest(() => {
			recordUpstream(call({ response: { name: "Asha" }, truncated: true }));
			return traceForResponse();
		});
		expect(calls[0]).not.toHaveProperty("response");
		expect(calls[0]).not.toHaveProperty("truncated");
		// The metadata a support desk actually needs still goes out.
		expect(calls[0]).toMatchObject({ clientRefId: "ref-1", status: 200 });
	});

	it("includes response bodies once a session has verified", async () => {
		const calls = await inRequest(() => {
			recordUpstream(call({ response: { name: "Asha" } }));
			markAuthenticated();
			return traceForResponse();
		});
		expect(calls[0]).toMatchObject({ response: { name: "Asha" } });
	});
});

/**
 * End-to-end wiring, which is what was actually missing: `createApp` must mount
 * `trace()` (without a scope every `recordUpstream` is a silent no-op) and its
 * `onError` must put the result on the response.
 */
describe("createApp wiring", () => {
	const cfg = loadConfig({
		JWT_SECRET: "x".repeat(32),
		SIMPLIBANK_API_HOST: "h",
		SIMPLIBANK_API_PORT: "1",
		SIMPLIBANK_API_PATH: "/p",
		EKO_DEVELOPER_KEY: "k",
		GITHUB_CLIENT_ID: "g",
		GITHUB_CLIENT_SECRET: "s",
		GITHUB_CALLBACK_URL: "https://x/cb",
		GITHUB_REPO: "o/r",
		COOKIE_SECURE: "false",
	});

	/** An app whose only upstream call records a trace entry, then fails. */
	function app(over: Partial<EkoClient>) {
		const kv = createInMemoryKV();
		const sessions = createSessions(cfg, kv);
		const eko = {
			sendOtp: vi.fn(async () => ({ ok: true, raw: {} })),
			getWalletBalance: vi.fn(async () => 0),
			...over,
		} as unknown as EkoClient;
		return {
			app: createApp({
				cfg,
				eko,
				zoho: { findLead: vi.fn(async () => false) },
				sessions,
				kv,
			}),
			sessions,
		};
	}

	/** Records one call carrying a response body, then fails the request. */
	async function failAfterUpstream(): Promise<never> {
		recordUpstream(call({ response: { name: "Asha" } }));
		throw new Error("upstream exploded");
	}

	it("attaches the trace to an error response", async () => {
		const { app: a } = app({ sendOtp: vi.fn(failAfterUpstream) });
		const res = await a.request("/auth/otp/start", {
			method: "POST",
			body: JSON.stringify({ mobile: "9990000001" }),
			headers: { "content-type": "application/json" },
		});
		expect(res.status).toBe(502);
		const body = (await res.json()) as { trace?: UpstreamCall[] };
		expect(body.trace).toHaveLength(1);
		expect(body.trace?.[0]).toMatchObject({ clientRefId: "ref-1" });
	});

	it("withholds the response body from an anonymous caller", async () => {
		const { app: a } = app({ sendOtp: vi.fn(failAfterUpstream) });
		const res = await a.request("/auth/otp/start", {
			method: "POST",
			body: JSON.stringify({ mobile: "9990000001" }),
			headers: { "content-type": "application/json" },
		});
		const body = (await res.json()) as { trace?: UpstreamCall[] };
		expect(body.trace?.[0]).not.toHaveProperty("response");
	});

	it("includes the response body for a verified session", async () => {
		// `getProfile` is the wallet route's first upstream hop, so failing it
		// exercises the same path without stubbing the ones in front of it.
		const { app: a, sessions } = app({
			getProfile: vi.fn(failAfterUpstream),
		});
		const token = await sessions.mintAccess({
			sub: "9990000001",
			role: "developer",
			orgId: 1,
		});
		const res = await a.request("/wallet/balance", {
			headers: { cookie: `eps_at=${token}` },
		});
		expect(res.status).toBe(502);
		const body = (await res.json()) as { trace?: UpstreamCall[] };
		expect(body.trace?.[0]).toMatchObject({ response: { name: "Asha" } });
	});

	it("omits the key entirely when nothing was recorded", async () => {
		const { app: a } = app({});
		const res = await a.request("/auth/otp/start", {
			method: "POST",
			body: JSON.stringify({ mobile: "no" }),
			headers: { "content-type": "application/json" },
		});
		expect(res.status).toBe(400);
		expect(await res.json()).not.toHaveProperty("trace");
	});
});

/**
 * The envelope contract, exercised through `createApp` rather than a harness.
 *
 * `errorBody` has exactly five call sites — the four `onError` branches and
 * `notFound` — and every one of them must carry the diagnostics, or a
 * screenshot of that particular failure is the one that tells ops nothing.
 */
describe("error envelope diagnostics", () => {
	const cfg = loadConfig({
		JWT_SECRET: "x".repeat(32),
		SIMPLIBANK_API_HOST: "h",
		SIMPLIBANK_API_PORT: "1",
		SIMPLIBANK_API_PATH: "/p",
		EKO_DEVELOPER_KEY: "k",
		GITHUB_CLIENT_ID: "g",
		GITHUB_CLIENT_SECRET: "s",
		GITHUB_CALLBACK_URL: "https://x/cb",
		GITHUB_REPO: "o/r",
		COOKIE_SECURE: "false",
	});

	function appWith(eko: Partial<EkoClient> = {}) {
		const kv = createInMemoryKV();
		return createApp({
			cfg,
			eko: {
				sendOtp: vi.fn(async () => ({ ok: true })),
				...eko,
			} as unknown as EkoClient,
			zoho: { findLead: vi.fn(async () => false) } as never,
			sessions: createSessions(cfg, kv),
			kv,
		});
	}

	/** Every error body carries these, whatever produced it. */
	function expectDiagnostics(body: Record<string, unknown>, rid: string) {
		expect(body.rid).toBe(rid);
		expect(body.version).toBe("dev");
		expect(Date.parse(String(body.ts))).not.toBeNaN();
	}

	it("carries rid, ts and version on a validation error", async () => {
		const res = await appWith().request("/auth/otp/start", {
			method: "POST",
			body: JSON.stringify({ mobile: "nope" }),
			headers: { "content-type": "application/json" },
		});
		expect(res.status).toBe(400);
		expectDiagnostics(
			(await res.json()) as Record<string, unknown>,
			res.headers.get("x-request-id") ?? "",
		);
	});

	it("carries them on a 404, the fifth errorBody site", async () => {
		const res = await appWith().request("/no/such/route");
		expect(res.status).toBe(404);
		const body = (await res.json()) as Record<string, unknown>;
		expect((body.error as { code: string }).code).toBe("NOT_FOUND");
		expectDiagnostics(body, res.headers.get("x-request-id") ?? "");
	});

	it("echoes the rid the caller supplied, so both sides name one request", async () => {
		const res = await appWith().request("/no/such/route", {
			headers: { "x-request-id": "caller-chosen-1" },
		});
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.rid).toBe("caller-chosen-1");
		expect(res.headers.get("x-request-id")).toBe("caller-chosen-1");
	});

	it("stamps the build on a successful response too", async () => {
		const res = await appWith().request("/healthz");
		expect(res.status).toBe(200);
		expect(res.headers.get("x-eps-version")).toBe("dev");
	});

	it("marks a proxy-authored message `proxy`", async () => {
		const res = await appWith().request("/auth/otp/start", {
			method: "POST",
			body: JSON.stringify({ mobile: "nope" }),
			headers: { "content-type": "application/json" },
		});
		const { error } = (await res.json()) as { error: { source: string } };
		expect(error.source).toBe("proxy");
	});

	it("withholds `cause` from an anonymous caller but keeps the 502", async () => {
		const res = await appWith({
			sendOtp: vi.fn(async () => {
				throw new Error("Eko upstream HTTP 503");
			}),
		}).request("/auth/otp/start", {
			method: "POST",
			body: JSON.stringify({ mobile: "9990000001" }),
			headers: { "content-type": "application/json" },
		});
		expect(res.status).toBe(502);
		const body = (await res.json()) as Record<string, unknown>;
		// The generic message stays; the internal reason is not owed to a caller
		// who has not proved who they are.
		expect((body.error as { message: string }).message).toBe(
			"Something went wrong",
		);
		expect(body.cause).toBeUndefined();
		expectDiagnostics(body, res.headers.get("x-request-id") ?? "");
	});
});

/**
 * The success-path echo. Its guards matter more than its happy path: this is
 * the one place a diagnostic rewrites a response that was already correct.
 */
describe("debugEcho", () => {
	/**
	 * An app whose `/ok` records an upstream call and returns JSON, and whose
	 * `/blob` returns a non-JSON body. `authed` models a verified session.
	 */
	function app(opts: { authed: boolean }) {
		const a = new Hono<AppEnv>();
		a.use("*", requestId());
		a.use("*", trace());
		a.use("*", debugEcho());
		a.use("*", async (c, next) => {
			if (opts.authed) markAuthenticated();
			await next();
		});
		a.get("/ok", (c) => {
			recordUpstream(call({ response: { name: "Asha" } }));
			return c.json({ balance: 10 });
		});
		a.get("/list", (c) => {
			recordUpstream(call());
			return c.json([1, 2, 3]);
		});
		a.get("/blob", (c) => {
			recordUpstream(call());
			return c.body("not json", 200, { "content-type": "text/csv" });
		});
		return a;
	}

	const on = { headers: { [DEBUG_HEADER]: "1" } };

	it("attaches _diag when a verified caller asks", async () => {
		const res = await app({ authed: true }).request("/ok", on);
		const body = (await res.json()) as Record<string, unknown>;
		// The original payload survives untouched alongside the diagnostic.
		expect(body.balance).toBe(10);
		const diag = body._diag as { rid: string; trace: UpstreamCall[] };
		expect(diag.trace).toHaveLength(1);
		expect(diag.rid).toBe(res.headers.get("x-request-id"));
	});

	it("stays off without the header — the default cost is zero", async () => {
		const res = await app({ authed: true }).request("/ok");
		expect(await res.json()).toEqual({ balance: 10 });
	});

	it("refuses an anonymous caller even when asked", async () => {
		const res = await app({ authed: false }).request("/ok", on);
		expect(await res.json()).toEqual({ balance: 10 });
	});

	it("leaves a non-JSON body alone rather than corrupting it", async () => {
		const res = await app({ authed: true }).request("/blob", on);
		expect(res.headers.get("content-type")).toContain("text/csv");
		expect(await res.text()).toBe("not json");
	});

	it("leaves an array body alone — it has nowhere to put a key", async () => {
		const res = await app({ authed: true }).request("/list", on);
		expect(await res.json()).toEqual([1, 2, 3]);
	});

	it("drops content-length so the rewritten body is not truncated", async () => {
		const res = await app({ authed: true }).request("/ok", on);
		const text = await res.text();
		const len = res.headers.get("content-length");
		if (len) expect(Number(len)).toBe(new TextEncoder().encode(text).length);
		expect(JSON.parse(text)).toHaveProperty("_diag");
	});
});
