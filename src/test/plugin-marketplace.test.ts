/**
 * Repo-consistency guard for the agent plugins: every `packages/claude-plugin-*`
 * bundle must be listed in the root `.claude-plugin/marketplace.json` (and vice
 * versa), have a valid manifest, ship at least one skill, and pin its MCP npm
 * specs to `@latest` (so installed plugins track new publishes).
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");

interface MarketplaceEntry {
	name: string;
	source: string;
	description: string;
}

interface PluginManifest {
	name: string;
	description: string;
	version: string;
}

interface McpConfig {
	mcpServers: Record<string, { command: string; args?: string[] }>;
}

const marketplace = JSON.parse(
	readFileSync(join(ROOT, ".claude-plugin", "marketplace.json"), "utf8"),
) as { name: string; plugins: MarketplaceEntry[] };

const pluginDirs = readdirSync(join(ROOT, "packages")).filter((d) =>
	d.startsWith("claude-plugin-"),
);

describe("plugin marketplace", () => {
	it("lists every packages/claude-plugin-* dir exactly once, and every source exists", () => {
		const sources = marketplace.plugins.map((p) => p.source);
		expect(new Set(sources).size).toBe(sources.length);
		for (const dir of pluginDirs)
			expect(sources).toContain(`./packages/${dir}`);
		for (const source of sources)
			expect(existsSync(join(ROOT, source))).toBe(true);
		expect(sources).toHaveLength(pluginDirs.length);
	});

	for (const entry of marketplace.plugins) {
		describe(`plugin ${entry.name}`, () => {
			const pluginRoot = join(ROOT, entry.source);
			const manifest = JSON.parse(
				readFileSync(join(pluginRoot, ".claude-plugin", "plugin.json"), "utf8"),
			) as PluginManifest;

			it("has a manifest whose name matches its marketplace entry", () => {
				expect(manifest.name).toBe(entry.name);
				expect(manifest.description).toBeTruthy();
				expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
			});

			it("wires MCP via a root .mcp.json that pins every @ekoindia spec to @latest", () => {
				// MCP must live in a plugin-root `.mcp.json` file (not inline in
				// plugin.json) so the cross-agent `plugins` installer wires it into
				// Codex/Cursor/OpenCode — those only read the file, never inline config.
				const mcpPath = join(pluginRoot, ".mcp.json");
				expect(existsSync(mcpPath)).toBe(true);
				const mcp = JSON.parse(readFileSync(mcpPath, "utf8")) as McpConfig;
				const servers = Object.values(mcp.mcpServers ?? {});
				expect(servers.length).toBeGreaterThan(0);
				for (const server of servers) {
					const pkgSpecs = (server.args ?? []).filter((a) =>
						a.startsWith("@ekoindia/"),
					);
					expect(pkgSpecs.length).toBeGreaterThan(0);
					for (const spec of pkgSpecs) expect(spec).toMatch(/@latest$/);
				}
			});

			it("ships at least one skill with a SKILL.md", () => {
				const skillsDir = join(pluginRoot, "skills");
				const skills = readdirSync(skillsDir);
				expect(skills.length).toBeGreaterThan(0);
				for (const skill of skills)
					expect(existsSync(join(skillsDir, skill, "SKILL.md"))).toBe(true);
			});

			it("has only non-empty markdown commands, if any", () => {
				const commandsDir = join(pluginRoot, "commands");
				if (!existsSync(commandsDir)) return;
				const commands = readdirSync(commandsDir);
				expect(commands.length).toBeGreaterThan(0);
				for (const command of commands) {
					expect(command).toMatch(/\.md$/);
					expect(
						readFileSync(join(commandsDir, command), "utf8").trim().length,
					).toBeGreaterThan(0);
				}
			});
		});
	}
});
