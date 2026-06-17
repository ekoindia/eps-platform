/**
 * Renders `/ai.md` — the markdown twin of the `/ai` hub page. Lists the
 * agent artifacts (packs, bundle, MCP, recipes) generated from the spec layer.
 */
import { buildInstallMatrix } from "@/lib/agent/build-install-matrix";
import { SITE_URL } from "@/lib/config/site";
import { RECIPES } from "@/lib/data/api-recipes";
import { markdownTable } from "@/lib/markdown/shared";

export function renderAgentsMarkdown(): string {
	const lines: string[] = [];
	lines.push("# EPS for AI agents");
	lines.push("");
	lines.push(
		"Everything an AI coding agent needs to integrate Eko Platform Services, " +
			"auto-generated from our API source of truth.",
	);
	lines.push("");

	lines.push("## Context packs");
	lines.push(
		markdownTable(
			["Target", "File"],
			[
				["Any agent (AGENTS.md)", `${SITE_URL}/agent/AGENTS.md`],
				["Claude Code (CLAUDE.md)", `${SITE_URL}/agent/CLAUDE.md`],
				["Cursor (.cursorrules)", `${SITE_URL}/agent/.cursorrules`],
				["GitHub Copilot", `${SITE_URL}/agent/copilot-instructions.md`],
			],
		),
	);
	lines.push("");

	lines.push("## Local MCP server");
	lines.push("");
	lines.push("```bash");
	lines.push("npx -y @ekoindia/eps-context-mcp");
	lines.push("```");
	lines.push("");

	lines.push("## Offline mock server");
	lines.push("");
	lines.push(
		"Develop and test EPS integrations offline — the mock server replays golden " +
			"sample responses (with recipe-aware error branching) so agents never touch " +
			"the live API:",
	);
	lines.push("");
	lines.push("```bash");
	lines.push("npx -y @ekoindia/eps-mock-server");
	lines.push("```");
	lines.push("");

	lines.push("## Claude Code plugin");
	lines.push("");
	lines.push(
		"One install wires the `eps` MCP, the `integrate-eps`, `sign-request` and " +
			"`run-a-recipe` skills, and the `/eps` slash command into Claude Code:",
	);
	lines.push("");
	lines.push("```bash");
	lines.push("/plugin marketplace add ekoindia/eko-eps-website");
	lines.push("/plugin install eps@ekoindia");
	lines.push("```");
	lines.push("");

	lines.push("## Install matrix");
	lines.push(
		"EPS rides on open standards (MCP + `AGENTS.md`-style context packs), so it " +
			"works in any modern coding agent. Wire it into each harness:",
	);
	lines.push(
		markdownTable(
			["Harness", "MCP command", "Pack file", "Placement"],
			buildInstallMatrix().map((h) => [
				h.name,
				h.mcp ? `\`${h.mcp}\`` : "—",
				h.packFile ? `[${h.packFile}](${SITE_URL}/agent/${h.packFile})` : "—",
				h.packPlacement ? `\`${h.packPlacement}\`` : "—",
			]),
		),
	);
	lines.push("");

	lines.push("## Machine bundle");
	lines.push(
		`- Canonical: ${SITE_URL}/agent/eps.json\n` +
			`- Index: ${SITE_URL}/agent/index.json\n` +
			`- Per-API: ${SITE_URL}/agent/api/<slug>.json\n` +
			`- OpenAPI: ${SITE_URL}/openapi.json`,
	);
	lines.push("");

	lines.push("## SDKs & tools");
	lines.push(
		markdownTable(
			["Tool", "Link"],
			[
				[
					"@ekoindia/eps-sdk (npm — Node.js)",
					"https://www.npmjs.com/package/@ekoindia/eps-sdk",
				],
				[
					"ekoindia/eps-sdk (Composer — PHP)",
					"https://packagist.org/packages/ekoindia/eps-sdk",
				],
				["Postman collection", `${SITE_URL}/agent/eps.postman_collection.json`],
			],
		),
	);
	lines.push(
		"Backend-only signed SDKs (HMAC baked in); keep `access_key` server-side only.",
	);
	lines.push("");

	lines.push("## Recipes");
	for (const r of RECIPES) lines.push(`- **${r.name}** — ${r.summary}`);
	lines.push("");

	return lines.join("\n");
}
