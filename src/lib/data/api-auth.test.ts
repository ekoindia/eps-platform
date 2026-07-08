import { describe, expect, it } from "vitest";
import { API_ENVIRONMENTS } from "./api-auth";

// ponytail: URL-parse + port==="" guards the exact regression we chased —
// a stray `:25004` (or any port) sneaking back into a base URL. Parsing beats
// a hand-rolled regex, which gets port-rejection precedence wrong.
describe("API_ENVIRONMENTS base URLs are portless", () => {
	const cases: Array<[keyof typeof API_ENVIRONMENTS, string, string]> = [
		["sandbox", "staging.eko.in", "/ekoapi/"],
		["production", "api.eko.in", "/ekoicici/"],
	];

	it.each(cases)(
		"%s: https, no port, expected host/path",
		(env, host, pathPrefix) => {
			const url = new URL(API_ENVIRONMENTS[env].baseUrl);
			expect(url.protocol).toBe("https:");
			expect(url.port).toBe(""); // no `:<port>` — the regression under guard
			expect(url.hostname).toBe(host);
			expect(url.pathname.startsWith(pathPrefix)).toBe(true);
		},
	);
});
