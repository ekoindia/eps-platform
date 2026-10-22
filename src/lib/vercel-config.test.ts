import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SITE_URL } from "./config/site";

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
	const linkRules = config.headers.filter((h) =>
		h.headers.some((x) => x.key === "Link"),
	);
	const twinRule = linkRules.find((h) => h.source.startsWith("/:path("));
	const indexRule = linkRules.find((h) => h.source === "/index.md");

	/** Emulates Vercel's match + `:path` substitution for the twin rule. */
	const canonicalFor = (pathname: string): string | undefined => {
		if (pathname === indexRule?.source) return indexRule.headers[0].value;
		const inner = twinRule?.source.match(/^\/:path\((.*)\)\\\.md$/)?.[1];
		const match = inner && new RegExp(`^/(${inner})\\.md$`).exec(pathname);
		return match
			? twinRule?.headers[0].value.replace(":path", match[1])
			: undefined;
	};

	it("points each twin at its HTML page", () => {
		expect(canonicalFor("/products/aeps-api.md")).toBe(
			`<${SITE_URL}/products/aeps-api>; rel="canonical"`,
		);
		expect(canonicalFor("/docs/sdk/python.md")).toBe(
			`<${SITE_URL}/docs/sdk/python>; rel="canonical"`,
		);
		expect(canonicalFor("/docs.md")).toBe(
			`<${SITE_URL}/docs>; rel="canonical"`,
		);
	});

	it("maps /index.md to the home page, and only via its own rule", () => {
		expect(canonicalFor("/index.md")).toBe(`<${SITE_URL}/>; rel="canonical"`);
		const inner = twinRule?.source.match(/^\/:path\((.*)\)\\\.md$/)?.[1];
		expect(new RegExp(`^/(${inner})\\.md$`).test("/index.md")).toBe(false);
	});

	it("ignores non-twin paths", () => {
		expect(canonicalFor("/products/aeps-api")).toBeUndefined();
		expect(canonicalFor("/llms.txt")).toBeUndefined();
	});
});
