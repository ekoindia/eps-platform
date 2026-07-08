# EPS plugin (`eps`)

A one-install agent plugin for integrating **Eko Platform Services (EPS)**
APIs from any coding agent. It bundles:

- the **`eps` MCP server** (`@ekoindia/eps-context-mcp`) — searchable EPS API
  context, signing snippets, and recipes, with zero hosting and zero secrets;
- three **skills** — `integrate-eps` (end-to-end integration flow),
  `sign-request` (backend-only HMAC-SHA256 request signing), and
  `run-a-recipe` (multi-step recipe runbooks);
- the **`/eps` slash command** — search the EPS API catalogue and scaffold a
  signed call.

Runtime sibling: the [`@ekoindia/eps-transact-mcp`](https://eps.eko.in/agents)
server lets AI agents _execute_ EPS verification APIs at runtime with your
credentials (hosted endpoint or local stdio) — it is not a coding-agent plugin.

## Install

**Claude Code** — from the Claude Code prompt:

```
/plugin marketplace add ekoindia/eps-platform
/plugin install eps@ekoindia
```

**Every other agent** — see the per-agent install matrix at
<https://eps.eko.in/ai> (Codex native plugin install, or direct MCP config for
Cursor, Copilot, Antigravity, Zed, Kiro, JetBrains, …).

Once installed, your agent launches the `eps` MCP automatically via `npx -y
@ekoindia/eps-context-mcp@latest` — no manual MCP configuration required. To
update the plugin, re-run the install command; the MCP server itself always
tracks the newest publish (`@latest` re-resolves at launch).

> **Codex note.** Codex (as of 0.142.5) installs the plugin's skills but does not
> yet launch its bundled stdio MCP server, so the `eps` search/`list_apis`/`get_api`
> tools won't appear. Until that's fixed upstream, add the server to Codex's native
> config (no credentials needed for this one):
>
> ```bash
> codex mcp add eps -- npx -y @ekoindia/eps-context-mcp@latest
> ```
>
> Set `startup_timeout_sec = 30` under `[mcp_servers.eps]` in `~/.codex/config.toml`
> to cover the npx cold-start.

## Use

- Run `/eps <query>` to search EPS APIs and start an integration (e.g.
  `/eps send money to a bank account`).
- Ask your agent to "integrate the EPS DMT API" to trigger the `integrate-eps`
  skill.
- Ask your agent to "sign an EPS request" to trigger the `sign-request` skill.
- Ask your agent to "run the DMT recipe" to trigger the `run-a-recipe` skill.

> `/eps` is a Claude Code convenience shortcut — the cross-agent installer does
> not translate slash commands into Codex/Cursor/OpenCode. On those agents the
> same flow runs via the `integrate-eps` skill (auto-discovered): just ask the
> agent to integrate an EPS API.

## Layout

```
.claude-plugin/plugin.json   # manifest (metadata only)
.mcp.json                    # eps MCP server wiring (read by every agent)
skills/integrate-eps/SKILL.md
skills/sign-request/SKILL.md
skills/run-a-recipe/SKILL.md
commands/eps.md              # /eps slash command (Claude Code only)
```

Not an npm package — it ships straight from this git repo via the marketplace
manifest at the repo root.

## Notes

- Signing is **backend-only**. The `access_key` is a server-side secret and must
  never be exposed in a browser or committed to source control.
- The MCP, skills, and command all defer to the live EPS API source of truth,
  so the catalogue stays current without re-publishing the plugin.
