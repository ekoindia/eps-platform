/**
 * Pure builder for the per-harness install matrix shown on /ai. Documents
 * the wiring (MCP config and/or context-pack file) for each supported coding
 * agent. The capability is provided by the open standards (MCP + AGENTS.md);
 * this just records how to enable it per tool. No I/O, no Date.
 *
 * MCP install differs per harness — the server name (`eps`), the package, and
 * the launch args are constant, but each tool registers them differently: a
 * CLI subcommand, a JSON config file with its own root key (`mcpServers` vs
 * `servers` vs `mcp` vs `context_servers`), or a TOML table. We record the
 * canonical method for each so the page can show the real steps, not a generic
 * `npx` line that no harness actually accepts verbatim.
 */
const PKG = "@ekoindia/eps-context-mcp";
/** Server name every harness registers EPS under. */
const SERVER = "eps";
/** Raw stdio launch command (referenced in the hero copy, not an install step). */
export const MCP_CMD = `npx -y ${PKG}`;

/**
 * Standard JSON config snippet: `{ <rootKey>: { eps: { command, args, ...extra } } }`.
 * Covers the many harnesses that share this shape and differ only in the root
 * key and a per-server flag or two.
 */
const jsonServer = (
	rootKey: string,
	extra: Record<string, unknown> = {},
): string =>
	JSON.stringify(
		{
			[rootKey]: { [SERVER]: { command: "npx", args: ["-y", PKG], ...extra } },
		},
		null,
		2,
	);

/** VS Code's one-shot CLI installer (`code --add-mcp '<json>'`). */
const vscodeAddCmd = `code --add-mcp '${JSON.stringify({
	name: SERVER,
	command: "npx",
	args: ["-y", PKG],
})}'`;

/** How a harness registers the EPS MCP server (present iff it supports MCP). */
export interface HarnessMcp {
	/** One-line CLI that registers the server, when the harness ships one. */
	command?: string;
	/** Config file the user edits, when install is (or can be) file-based. */
	configFile?: string;
	/** Snippet to drop into `configFile` (or paste into the harness's MCP UI). */
	configSnippet?: string;
	/** Short qualifier shown under the block (scope, CLI-vs-IDE caveats, etc.). */
	note?: string;
}

export interface HarnessInstall {
	id: string;
	name: string;
	/** MCP wiring, when the harness supports MCP servers. */
	mcp?: HarnessMcp;
	/** Context-pack file to drop in (relative to /agent), when applicable. */
	packFile?: string;
	/** Where the pack goes in the user's repo. */
	packPlacement?: string;
}

export const HARNESSES: HarnessInstall[] = [
	{
		id: "claude-code",
		name: "Claude Code",
		mcp: {
			// `--scope project` before `--` so it's parsed as a flag, not passed
			// to npx; the `--` then stops Claude swallowing the package's `-y`.
			command: `claude mcp add ${SERVER} --scope project -- ${MCP_CMD}`,
			note: "`--scope project` writes a shared `.mcp.json` committed with the repo. Use `--scope user` for every project on this machine, or drop the flag for local scope (private to this checkout, not shared).",
		},
		packFile: "CLAUDE.md",
		packPlacement: "./CLAUDE.md",
	},
	{
		id: "cursor",
		name: "Cursor",
		mcp: {
			configFile: ".cursor/mcp.json",
			configSnippet: jsonServer("mcpServers"),
			note: "No CLI — create the file (use `~/.cursor/mcp.json` to enable it globally).",
		},
		packFile: ".cursorrules",
		packPlacement: "./.cursorrules",
	},
	{
		id: "codex",
		name: "Codex",
		mcp: {
			command: `codex mcp add ${SERVER} npx -y ${PKG}`,
			// Alternative to the CLI: a TOML `mcp_servers` table (not JSON).
			configFile: "~/.codex/config.toml",
			configSnippet: `[mcp_servers.${SERVER}]\ncommand = "npx"\nargs = ["-y", "${PKG}"]`,
			note: "CLI or the config file — either registers the server.",
		},
		packFile: "AGENTS.md",
		packPlacement: "./AGENTS.md",
	},
	{
		id: "antigravity",
		name: "Antigravity",
		mcp: {
			configFile: "~/.gemini/config/mcp_config.json",
			configSnippet: jsonServer("mcpServers"),
			note: "Global file shown; use `.agents/mcp_config.json` in the repo root to scope it to one project.",
		},
		packFile: "AGENTS.md",
		packPlacement: "./GEMINI.md",
	},
	{
		id: "copilot",
		name: "GitHub Copilot",
		mcp: {
			// Copilot in VS Code: one-shot CLI, or a workspace file whose root key
			// is `servers` (not `mcpServers`) with an explicit transport type.
			command: vscodeAddCmd,
			configFile: ".vscode/mcp.json",
			configSnippet: jsonServer("servers", { type: "stdio" }),
			note: "These wire Copilot in VS Code. For the Copilot CLI, run `/mcp add` (interactive) or edit `~/.copilot/mcp-config.json`.",
		},
		packFile: "copilot-instructions.md",
		packPlacement: "./.github/copilot-instructions.md",
	},
	{
		id: "opencode",
		name: "OpenCode",
		mcp: {
			configFile: "opencode.json",
			// opencode's root key is `mcp`, `command` is a single array, type `local`.
			configSnippet: JSON.stringify(
				{
					$schema: "https://opencode.ai/config.json",
					mcp: {
						[SERVER]: {
							type: "local",
							command: ["npx", "-y", PKG],
							enabled: true,
						},
					},
				},
				null,
				2,
			),
			note: "Project root, or `~/.config/opencode/opencode.json` for every project.",
		},
		packFile: "AGENTS.md",
		packPlacement: "./AGENTS.md",
	},
	{
		id: "kiro",
		name: "Kiro",
		mcp: {
			configFile: ".kiro/settings/mcp.json",
			// Standard `mcpServers` shape; same file under `~/.kiro/settings/mcp.json`
			// scopes it to every project.
			configSnippet: jsonServer("mcpServers"),
			note: "No CLI — create the file, or open it via the command palette (`Kiro: Open workspace MCP config (JSON)`). Use `~/.kiro/settings/mcp.json` for every project. Enable MCP under Settings (`cmd-,` → search “MCP”).",
		},
		packFile: "AGENTS.md",
		packPlacement: ".kiro/steering/eps.md",
	},
	// {
	// 	id: "gemini-cli",
	// 	name: "Gemini CLI",
	// 	mcp: {
	// 		configFile: "~/.gemini/settings.json",
	// 		configSnippet: jsonServer("mcpServers"),
	// 		note: "Global file shown; use `.gemini/settings.json` in the repo root to scope it to one project.",
	// 	},
	// 	packFile: "AGENTS.md",
	// 	packPlacement: "./GEMINI.md",
	// },
	// { id: "continue", name: "Continue", mcp: MCP_CMD },	// Acquired by Cursor. No public docs or API, so omitting for now.
	// {
	// 	id: "windsurf",
	// 	name: "Windsurf",
	// 	packFile: "AGENTS.md",
	// 	packPlacement: "./.windsurfrules",
	// }, // Windsurf is now "Devin Desktop". Ommiting to avoid confusion, until we can verify MCP support and get updated pack instructions.
	// { id: "cody", name: "Cody", packFile: "AGENTS.md" },
	{
		id: "zed",
		name: "Zed",
		mcp: {
			configFile: "Zed settings.json",
			// Zed calls MCP servers "context servers" under a `context_servers` key.
			configSnippet: jsonServer("context_servers"),
			note: "Open with `cmd-,`, or add it via Agent Panel → Settings → Add Custom Server.",
		},
		packFile: "AGENTS.md",
	},
	{
		id: "aider",
		name: "Aider",
		// aider has no native MCP client — context pack only.
		packFile: "AGENTS.md",
		packPlacement: "CONVENTIONS.md",
	},
	{
		id: "jetbrains-ai",
		name: "JetBrains AI",
		mcp: {
			configSnippet: jsonServer("mcpServers"),
			note: "Paste into Settings → Tools → AI Assistant → Model Context Protocol (MCP). Requires AI Assistant 2025.1+.",
		},
		packFile: "AGENTS.md",
	},
	{
		id: "others",
		name: "Others",
		mcp: {
			// The de-facto standard most MCP clients accept verbatim.
			configSnippet: jsonServer("mcpServers"),
			note: "Most MCP clients accept this standard config — add it to your client's MCP config file. A few use a different root key (`servers`, `mcp`, `context_servers`); check the tool's docs. Pair it with the AGENTS.md context pack below.",
		},
		packFile: "AGENTS.md",
	},
];

export const buildInstallMatrix = (): HarnessInstall[] => HARNESSES;
