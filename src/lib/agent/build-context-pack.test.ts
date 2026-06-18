import { describe, expect, it } from "vitest";

import { getDocumentedSpecs } from "@/lib/data/docs-registry";
import { buildAgentBundle } from "@/lib/agent/build-agent-bundle";
import {
	CONTEXT_PACK_FILES,
	buildContextPackBody,
} from "@/lib/agent/build-context-pack";

const bundle = buildAgentBundle(getDocumentedSpecs());
const body = buildContextPackBody(bundle);

describe("buildContextPackBody", () => {
	it("inlines the auth + backend-only warning", () => {
		expect(body).toMatch(/backend-only/i);
		expect(body).toContain("secret-key");
		expect(body).toContain("developer_key");
	});

	it("lists every documented endpoint by name", () => {
		for (const api of bundle.apis) expect(body).toContain(api.name);
	});

	it("points at the MCP package and the bundle", () => {
		expect(body).toContain("@ekoindia/eps-context-mcp");
		expect(body).toContain("/agent/eps.json");
	});

	it("documents the offline mock server for local testing", () => {
		expect(body).toContain("@ekoindia/eps-mock-server");
		expect(body).toContain("http://localhost:4010");
		expect(body).toContain("eps_scenario");
	});

	it("includes the exemplar recipes", () => {
		expect(body).toContain("DMT — Send Money");
		expect(body).toContain("AePS — Cash Withdrawal");
	});
});

describe("CONTEXT_PACK_FILES", () => {
	it("emits the four target files, each wrapping the canonical body", () => {
		const files = CONTEXT_PACK_FILES.map((f) => f.file);
		expect(files).toEqual([
			"AGENTS.md",
			"CLAUDE.md",
			".cursorrules",
			"copilot-instructions.md",
		]);
		for (const f of CONTEXT_PACK_FILES) {
			const out = f.build(bundle);
			expect(out).toContain("## Authentication & request signing");
		}
	});
});
