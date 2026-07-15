import { afterEach, describe, expect, it, vi } from "vitest";
import { aiGettingStartedNotice } from "./shared";

afterEach(() => vi.unstubAllEnvs());

describe("aiGettingStartedNotice test credentials", () => {
	it("publishes the UAT keys when both are configured", () => {
		vi.stubEnv("VITE_EPS_UAT_DEVELOPER_KEY", "dev-key-123");
		vi.stubEnv("VITE_EPS_UAT_ACCESS_KEY", "access-key-456");

		const notice = aiGettingStartedNotice();

		expect(notice).toContain("developer_key=dev-key-123");
		expect(notice).toContain("access_key=access-key-456");
	});

	// Regression: these are read from import.meta.env, never process.env — Vite
	// loads .env files into import.meta.env only, so the process.env spelling
	// silently published the literal string "undefined" to llms.txt / index.md.
	it("never publishes the string 'undefined' as a credential", () => {
		vi.stubEnv("VITE_EPS_UAT_DEVELOPER_KEY", "");
		vi.stubEnv("VITE_EPS_UAT_ACCESS_KEY", "");

		const notice = aiGettingStartedNotice();

		expect(notice).not.toContain("undefined");
		expect(notice).not.toContain("developer_key=");
	});

	it("omits the bullet when only one key is configured", () => {
		vi.stubEnv("VITE_EPS_UAT_DEVELOPER_KEY", "dev-key-123");
		vi.stubEnv("VITE_EPS_UAT_ACCESS_KEY", "");

		const notice = aiGettingStartedNotice();

		expect(notice).not.toContain("Test credentials");
		expect(notice).not.toContain("dev-key-123");
	});

	it("still lists the agent artifacts when credentials are absent", () => {
		vi.stubEnv("VITE_EPS_UAT_DEVELOPER_KEY", "");
		vi.stubEnv("VITE_EPS_UAT_ACCESS_KEY", "");

		const notice = aiGettingStartedNotice();

		expect(notice).toContain("/agent/eps.json");
		expect(notice).toContain("/openapi.json");
	});
});
