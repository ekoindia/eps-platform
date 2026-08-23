import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { contextMcpErrorBody, mountContextMcp } from "./contextMcp";
import type { AppEnv } from "./requestId";

const BUNDLE_URL = "https://eps.example/agent/eps.json";

/** Smallest object `isUsableBundle` accepts, plus what the MCP server reads. */
function bundle(bundleVersion: string) {
	return {
		meta: {
			org: "ekoindia",
			apiVersion: "v3",
			bundleVersion,
			environments: [],
		},
		topics: {},
		apis: [
			{
				slug: "pan-verify",
				name: "PAN",
				method: "POST",
				path: "/pan",
				docsUrl: "https://eps.eko.in/docs/pan-verify",
			},
		],
		recipes: [],
	};
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { "content-type": "application/json", etag: '"v1"', ...init.headers },
		...init,
	});
}

function harness(opts: { ttlSec?: number; fetchImpl: typeof fetch }) {
	const app = new Hono<AppEnv>();
	mountContextMcp(app, {
		bundleUrl: BUNDLE_URL,
		ttlSec: opts.ttlSec ?? 900,
		fetchImpl: opts.fetchImpl,
	});
	return app;
}

/** Lets the detached boot refresh settle before the first assertion. */
const settle = () => new Promise((r) => setTimeout(r, 0));

describe("mountContextMcp", () => {
	it("503s with a JSON-RPC body until the first load succeeds", async () => {
		const fetchImpl = vi.fn().mockRejectedValue(new Error("offline"));
		const app = harness({ fetchImpl: fetchImpl as unknown as typeof fetch });
		await settle();

		const res = await app.request("/context/healthz");
		expect(res.status).toBe(503);
		expect(await res.json()).toMatchObject({
			jsonrpc: "2.0",
			error: { code: -32000 },
		});
	});

	it("serves healthz with the loaded bundleVersion and source remote", async () => {
		const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(bundle("aaa")));
		const app = harness({ fetchImpl: fetchImpl as unknown as typeof fetch });
		await settle();

		const res = await app.request("/context/healthz");
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			ok: true,
			bundleVersion: "aaa",
			source: "remote",
		});
	});

	it("answers an anonymous MCP initialize", async () => {
		const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(bundle("aaa")));
		const app = harness({ fetchImpl: fetchImpl as unknown as typeof fetch });
		await settle();

		const res = await app.request(
			new Request("http://local/context/mcp", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					accept: "application/json, text/event-stream",
				},
				body: JSON.stringify({
					jsonrpc: "2.0",
					id: 1,
					method: "initialize",
					params: {
						protocolVersion: "2024-11-05",
						capabilities: {},
						clientInfo: { name: "test", version: "0" },
					},
				}),
			}),
		);
		expect(res.status).toBe(200);
		expect(res.headers.get("cache-control")).toBe("no-store");
		expect(res.headers.get("set-cookie")).toBeNull();
	});

	it("405s a GET on /context/mcp", async () => {
		const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(bundle("aaa")));
		const app = harness({ fetchImpl: fetchImpl as unknown as typeof fetch });
		await settle();

		const res = await app.request("/context/mcp");
		expect(res.status).toBe(405);
		expect(res.headers.get("allow")).toBe("POST");
	});

	it("does not re-fetch inside the TTL", async () => {
		const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(bundle("aaa")));
		const app = harness({ fetchImpl: fetchImpl as unknown as typeof fetch });
		await settle();

		await app.request("/context/healthz");
		await app.request("/context/healthz");
		expect(fetchImpl).toHaveBeenCalledTimes(1);
	});

	it("revalidates with If-None-Match past the TTL and keeps the bundle on 304", async () => {
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(jsonResponse(bundle("aaa")))
			.mockResolvedValueOnce(new Response(null, { status: 304 }));
		const app = harness({
			ttlSec: 0,
			fetchImpl: fetchImpl as unknown as typeof fetch,
		});
		await settle();

		await app.request("/context/healthz");
		await settle();
		expect(fetchImpl).toHaveBeenCalledTimes(2);
		expect(fetchImpl.mock.calls[1][1]).toMatchObject({
			headers: { "if-none-match": '"v1"' },
		});

		const res = await app.request("/context/healthz");
		expect(await res.json()).toMatchObject({ bundleVersion: "aaa" });
	});

	it("adopts a refreshed bundle for later requests", async () => {
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(jsonResponse(bundle("aaa")))
			.mockResolvedValueOnce(jsonResponse(bundle("bbb")));
		const app = harness({
			ttlSec: 0,
			fetchImpl: fetchImpl as unknown as typeof fetch,
		});
		await settle();

		await app.request("/context/healthz"); // triggers refresh behind the response
		await settle();
		const res = await app.request("/context/healthz");
		expect(await res.json()).toMatchObject({ bundleVersion: "bbb" });
	});

	it.each([
		["a non-2xx", () => new Response("nope", { status: 500 })],
		["a network error", () => Promise.reject(new Error("boom"))],
		["unparseable JSON", () => new Response("<html>", { status: 200 })],
		["a valid-JSON non-bundle", () => jsonResponse({ meta: {} })],
		[
			"the index slice (same top-level keys, body-free apis)",
			() =>
				jsonResponse({
					meta: { bundleVersion: "idx" },
					topics: ["auth", "errors"],
					apis: [{ slug: "pan-verify", name: "PAN", method: "POST", path: "/pan" }],
					recipes: [],
				}),
		],
	])("keeps the last-good bundle across %s", async (_label, bad) => {
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(jsonResponse(bundle("aaa")))
			.mockImplementationOnce(bad as () => Promise<Response>);
		const app = harness({
			ttlSec: 0,
			fetchImpl: fetchImpl as unknown as typeof fetch,
		});
		await settle();

		await app.request("/context/healthz");
		await settle();
		const res = await app.request("/context/healthz");
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ bundleVersion: "aaa" });
	});

	it("single-flights concurrent refreshes", async () => {
		let release: (r: Response) => void = () => {};
		const fetchImpl = vi
			.fn()
			.mockImplementation(
				() => new Promise<Response>((resolve) => (release = resolve)),
			);
		const app = harness({ fetchImpl: fetchImpl as unknown as typeof fetch });
		await settle();

		await Promise.all([
			app.request("/context/healthz"),
			app.request("/context/healthz"),
		]);
		expect(fetchImpl).toHaveBeenCalledTimes(1);
		release(jsonResponse(bundle("aaa")));
	});

	it("does not hot-loop fetches while the origin is down", async () => {
		const fetchImpl = vi.fn().mockRejectedValue(new Error("offline"));
		const app = harness({
			ttlSec: 900,
			fetchImpl: fetchImpl as unknown as typeof fetch,
		});
		await settle();

		await app.request("/context/healthz");
		await app.request("/context/healthz");
		await settle();
		// One attempt at boot; the failed attempt still stamps the TTL clock.
		expect(fetchImpl).toHaveBeenCalledTimes(1);
	});

	it("contains a handler failure as a JSON-RPC error, not the BFF envelope", async () => {
		const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(bundle("aaa")));
		const app = harness({ fetchImpl: fetchImpl as unknown as typeof fetch });
		// Mirrors app.ts: Hono sends thrown handler errors to onError, never to a
		// middleware catch, so containment is asserted the way production wires it.
		app.onError((_err, c) => c.json(contextMcpErrorBody(), 500));
		app.get("/context/boom", () => {
			throw new Error("kaboom");
		});
		await settle();

		const res = await app.request("/context/boom");
		expect(res.status).toBe(500);
		expect(await res.json()).toMatchObject({
			jsonrpc: "2.0",
			error: { code: -32603 },
		});
	});

});
