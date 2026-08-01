import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { API_AUTH_INFO, API_ENVIRONMENTS } from "./api-auth";

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

// The vector is published to agents (bundle `auth` topic → `debug_auth`) and to
// humans (the docs playground) as a known-answer test. It is only worth anything
// if it is actually right, so recompute it from an independent implementation.
describe("API_AUTH_INFO.testVector", () => {
	const { accessKey, timestamp, secretKey } = API_AUTH_INFO.testVector;

	it("reproduces under an independent HMAC implementation", () => {
		const expected = createHmac(
			"sha256",
			Buffer.from(accessKey).toString("base64"),
		)
			.update(timestamp)
			.digest("base64");
		expect(secretKey).toBe(expected);
	});

	it("uses milliseconds and carries no real credential", () => {
		expect(timestamp).toMatch(/^\d{13}$/);
		expect(accessKey).toMatch(/^test-/);
	});
});
