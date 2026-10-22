import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SITE_URL } from "./config/site";
import {
	alternateTwinPath,
	headerValueFor,
	sourceToRegExp,
} from "./markdown/vercel-header-rules";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const config = JSON.parse(
	readFileSync(resolve(repoRoot, "vercel.json"), "utf8"),
) as {
	routes?: Array<{ src: string; dest: string; env?: string[] }>;
	rewrites: Array<{ source: string; destination: string }>;
	headers: Array<{
		source: string;
		headers: Array<{ key: string; value: string }>;
	}>;
};

// The console calls the backend at the same-origin path "/api" (see
// src/lib/auth/client.ts). Production once had nothing serving it, so /api/me
// fell through to the SPA catch-all below and answered 200 + index.html — which
// the app then tried to read as a session.
describe("vercel.json /api proxy", () => {
	const apiRoute = config.routes?.find((r) => r.src.startsWith("/api"));

	it("proxies /api through `routes`, not `rewrites`", () => {
		expect(apiRoute).toBeDefined();
		// `rewrites` are matched after `routes` and this file's last rewrite is a
		// catch-all, so an /api rule added there would be shadowed by it.
		expect(config.rewrites.some((r) => r.source.startsWith("/api"))).toBe(
			false,
		);
	});

	it("strips the /api prefix, matching the dev proxy", () => {
		// vite.config.ts does rewrite: (p) => p.replace(/^\/api/, "")
		expect(apiRoute?.dest).toMatch(/\/\$1$/);
		expect(apiRoute?.dest).not.toMatch(/\/api\/\$1$/);
	});

	it("takes the backend origin from the environment, never a committed host", () => {
		expect(apiRoute?.env).toContain("EPS_BACKEND_ORIGIN");
		expect(apiRoute?.dest).toContain("${EPS_BACKEND_ORIGIN}");
		// A hostname baked in here would both leak infrastructure into the repo
		// and need a code change to move environments.
		expect(apiRoute?.dest).not.toMatch(/https?:\/\/[a-z]/i);
	});

	it("keeps the SPA catch-all last so it cannot shadow earlier rules", () => {
		const last = config.rewrites[config.rewrites.length - 1];
		expect(last.destination).toBe("/__spa-fallback.html");
	});
});

// Every .md twin carries `Link: <html page>; rel="canonical"` so search engines
// fold it into its HTML page instead of indexing a duplicate.
describe("vercel.json .md twin canonical Link header", () => {
	const link = (p: string) => headerValueFor(config.headers, p, "Link");

	it("points each twin at its HTML page", () => {
		expect(link("/products/aeps-api.md")).toBe(
			`<${SITE_URL}/products/aeps-api>; rel="canonical"`,
		);
		expect(link("/docs/sdk/python.md")).toBe(
			`<${SITE_URL}/docs/sdk/python>; rel="canonical"`,
		);
		expect(link("/docs.md")).toBe(`<${SITE_URL}/docs>; rel="canonical"`);
	});

	it("maps /index.md to the home page, and only via its own rule", () => {
		expect(link("/index.md")).toBe(`<${SITE_URL}/>; rel="canonical"`);
		const twinRule = config.headers.find((h) => h.source.startsWith("/:path("));
		expect(sourceToRegExp(twinRule!.source).test("/index.md")).toBe(false);
	});

	it("ignores non-twin paths", () => {
		expect(link("/llms.txt")).toBeUndefined();
		expect(link("/assets/index-abc.js")).toBeUndefined();
	});
});

// Every HTML page with a twin advertises it, so an agent finds the markdown
// from a HEAD request. The build guard in vite-plugin-generate-markdown.ts
// fails the build if a prerendered route advertises a twin that isn't written.
describe("vercel.json HTML → .md alternate Link header", () => {
	const twin = (p: string) => alternateTwinPath(config.headers, p);

	it("advertises the twin for each section and fixed page", () => {
		expect(twin("/")).toBe("/index.md");
		expect(twin("/products")).toBe("/products.md");
		expect(twin("/products/aeps-api")).toBe("/products/aeps-api.md");
		expect(twin("/industries/fintech")).toBe("/industries/fintech.md");
		expect(twin("/docs/how-auth-works")).toBe("/docs/how-auth-works.md");
		expect(twin("/docs/sdk")).toBe("/docs/sdk.md");
		expect(twin("/docs/sdk/python")).toBe("/docs/sdk/python.md");
		expect(twin("/recipe/bbps-bill-payment")).toBe(
			"/recipe/bbps-bill-payment.md",
		);
		expect(twin("/pricing")).toBe("/pricing.md");
	});

	it("never advertises a twin for private, twin-less or non-HTML paths", () => {
		for (const p of [
			"/console",
			"/console/credentials",
			"/admin",
			"/industries", // section index has no twin
			"/about-us",
			"/samples/partner-agreement", // noindex
			"/products/aeps-api.md", // the twin itself
			"/assets/index-abc.js",
			"/llms.txt",
		])
			expect(twin(p), p).toBeUndefined();
	});
});
