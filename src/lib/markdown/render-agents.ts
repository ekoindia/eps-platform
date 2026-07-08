/**
 * Renders `/ai.md` — the markdown twin of the `/ai` hub page. Lists the
 * agent artifacts (packs, bundle, MCP, recipes) generated from the spec layer.
 */
import { buildInstallMatrix } from "@/lib/agent/build-install-matrix";
import { SHOW_PLUGINS_ADD } from "@/lib/config/features";
import { EPS_MCP_PKG, PLUGINS_ADD_CMD, SITE_URL } from "@/lib/config/site";
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

	if (SHOW_PLUGINS_ADD) {
		lines.push("## One-command install (recommended)");
		lines.push("");
		lines.push(
			"Installs the chosen EPS plugins (MCP server + skills + commands) into " +
				"every detected coding agent — Claude Code, Codex, Cursor, OpenCode. " +
				"Pick `eps` for dev-time API context; add `eps-transact` to let agents " +
				"run verifications at runtime with your credentials. Re-run to update:",
		);
		lines.push("");
		lines.push("```bash");
		lines.push(PLUGINS_ADD_CMD);
		lines.push("```");
		lines.push("");
	} else {
		// Per-agent plugin install (the one-command path is disabled). Data-driven
		// from the matrix so it stays in step with the /ai page tabs.
		lines.push("## Plugin install (Claude Code & Codex)");
		lines.push("");
		lines.push(
			"Two-step native plugin install — add the marketplace, then install the " +
				"`eps` plugin (skills + `/eps` command; wires the MCP automatically on " +
				"Claude Code). Other agents: see the manual install matrix below.",
		);
		for (const h of buildInstallMatrix()) {
			if (!h.pluginInstall) continue;
			lines.push("");
			lines.push(`**${h.name}**`);
			lines.push("");
			lines.push("```bash");
			for (const step of h.pluginInstall.steps) lines.push(step.text);
			lines.push("```");
			if (h.pluginInstall.note) lines.push(`> ${h.pluginInstall.note}`);
		}
		lines.push("");
	}

	lines.push("## Context packs (fallback)");
	lines.push(
		"Append-able EPS sections for agents without MCP or skills support — " +
			"add to your existing instruction file, don't replace it:",
	);
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
	lines.push(`npx -y ${EPS_MCP_PKG}`);
	lines.push("```");
	lines.push("");

	lines.push("## Offline mock server");
	lines.push("");
	lines.push(
		"Pairs with the MCP for offline testing — the mock server replays golden " +
			"sample responses (with recipe-aware error branching) so agents develop and " +
			"test without ever touching the live API:",
	);
	lines.push("");
	lines.push("```bash");
	lines.push("npx -y @ekoindia/eps-mock-server");
	lines.push("```");
	lines.push("");
	lines.push(
		"It mirrors the real EPS paths — point your EPS base URL at " +
			"`http://localhost:4010`, then append `?eps_scenario=<response_status_id>` " +
			"to force a documented error branch.",
	);
	lines.push("");

	if (SHOW_PLUGINS_ADD) {
		lines.push("## Claude Code native plugin manager");
		lines.push("");
		lines.push(
			"Alternative to the one-command install above — wires the `eps` MCP, the " +
				"`integrate-eps`, `sign-request` and `run-a-recipe` skills, and the " +
				"`/eps` slash command into Claude Code:",
		);
		lines.push("");
		lines.push("```bash");
		lines.push("/plugin marketplace add ekoindia/eps-platform");
		lines.push("/plugin install eps@ekoindia");
		lines.push("```");
		lines.push("");
	}

	lines.push("## Manual install matrix (other agents)");
	lines.push(
		"EPS rides on open standards (MCP + `AGENTS.md`-style context packs), so it " +
			"works in any modern coding agent. Wire it into each harness:",
	);
	lines.push(
		markdownTable(
			["Harness", "MCP install", "Pack file", "Placement"],
			buildInstallMatrix().map((h) => [
				h.name,
				h.mcp
					? `\`${h.mcp.command ?? h.mcp.configFile ?? "MCP config"}\``
					: "—",
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
