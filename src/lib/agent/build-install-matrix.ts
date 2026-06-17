/**
 * Pure builder for the per-harness install matrix shown on /ai. Documents
 * the wiring (MCP config and/or context-pack file) for each supported coding
 * agent. The capability is provided by the open standards (MCP + AGENTS.md);
 * this just records how to enable it per tool. No I/O, no Date.
 */
const MCP_CMD = "npx -y @ekoindia/eps-context-mcp";

export interface HarnessInstall {
	id: string;
	name: string;
	/** MCP launch command, when the harness supports MCP. */
	mcp?: string;
	/** Context-pack file to drop in (relative to /agent), when applicable. */
	packFile?: string;
	/** Where the pack goes in the user's repo. */
	packPlacement?: string;
}

export const HARNESSES: HarnessInstall[] = [
	{
		id: "claude-code",
		name: "Claude Code",
		mcp: MCP_CMD,
		packFile: "CLAUDE.md",
		packPlacement: "./CLAUDE.md",
	},
	{
		id: "cursor",
		name: "Cursor",
		mcp: MCP_CMD,
		packFile: ".cursorrules",
		packPlacement: "./.cursorrules",
	},
	{
		id: "codex",
		name: "Codex",
		mcp: MCP_CMD,
		packFile: "AGENTS.md",
		packPlacement: "./AGENTS.md",
	},
	{
		id: "gemini-cli",
		name: "Gemini CLI",
		mcp: MCP_CMD,
		packFile: "AGENTS.md",
		packPlacement: "./GEMINI.md",
	},
	{
		id: "opencode",
		name: "opencode",
		mcp: MCP_CMD,
		packFile: "AGENTS.md",
		packPlacement: "./AGENTS.md",
	},
	{ id: "continue", name: "Continue", mcp: MCP_CMD },
	{
		id: "copilot",
		name: "GitHub Copilot",
		packFile: "copilot-instructions.md",
		packPlacement: "./.github/copilot-instructions.md",
	},
	{
		id: "windsurf",
		name: "Windsurf",
		packFile: "AGENTS.md",
		packPlacement: "./.windsurfrules",
	},
	{ id: "cody", name: "Cody", packFile: "AGENTS.md" },
	{ id: "zed", name: "Zed", mcp: MCP_CMD, packFile: "AGENTS.md" },
	{
		id: "aider",
		name: "aider",
		packFile: "AGENTS.md",
		packPlacement: "CONVENTIONS.md",
	},
	{ id: "jetbrains-ai", name: "JetBrains AI", packFile: "AGENTS.md" },
];

export const buildInstallMatrix = (): HarnessInstall[] => HARNESSES;
