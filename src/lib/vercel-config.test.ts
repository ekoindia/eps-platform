import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const config = JSON.parse(
	readFileSync(resolve(repoRoot, "vercel.json"), "utf8"),
) as {
	routes?: Array<{ src: string; dest: string; env?: string[] }>;
	rewrites: Array<{ source: string; destination: string }>;
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
