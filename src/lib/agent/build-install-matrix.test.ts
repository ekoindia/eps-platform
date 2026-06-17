import { describe, expect, it } from "vitest";

import {
	buildInstallMatrix,
	HARNESSES,
} from "@/lib/agent/build-install-matrix";

const matrix = buildInstallMatrix();

describe("buildInstallMatrix", () => {
	it("covers every listed harness", () => {
		expect(matrix.length).toBe(HARNESSES.length);
		const ids = matrix.map((m) => m.id);
		for (const h of [
			"claude-code",
			"cursor",
			"codex",
			"gemini-cli",
			"copilot",
			"opencode",
		])
			expect(ids).toContain(h);
	});

	it("each MCP-capable harness references the eps-context-mcp package", () => {
		for (const m of matrix.filter((x) => x.mcp)) {
			const blob = `${m.mcp?.command ?? ""}\n${m.mcp?.configSnippet ?? ""}`;
			expect(blob).toContain("@ekoindia/eps-context-mcp");
		}
	});

	it("each MCP entry exposes at least one install mechanism (command or config)", () => {
		for (const m of matrix.filter((x) => x.mcp))
			expect(Boolean(m.mcp?.command) || Boolean(m.mcp?.configSnippet)).toBe(
				true,
			);
	});

	it("each entry names a pack file or an MCP config (at least one mechanism)", () => {
		for (const m of matrix)
			expect(Boolean(m.mcp) || Boolean(m.packFile)).toBe(true);
	});

	it("GitHub Copilot supports MCP", () => {
		const copilot = matrix.find((m) => m.id === "copilot");
		expect(copilot?.mcp).toBeTruthy();
	});
});
