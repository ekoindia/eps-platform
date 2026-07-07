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

Sibling plugin: [`eps-transact`](../claude-plugin-eps-transact/) lets AI agents
*execute* EPS verification APIs at runtime with your credentials.

## Install

One command, any supported agent (Claude Code, Codex, Cursor, OpenCode —
auto-detected):

```bash
npx plugins add ekoindia/eps-platform
```

…and pick **eps**. Claude Code native alternative, from the Claude Code prompt:

```
/plugin marketplace add ekoindia/eps-platform
/plugin install eps@ekoindia
```

Once installed, your agent launches the `eps` MCP automatically via `npx -y
@ekoindia/eps-context-mcp@latest` — no manual MCP configuration required. To
update the plugin, re-run the install command; the MCP server itself always
tracks the newest publish (`@latest` re-resolves at launch).

## Use

- Run `/eps <query>` to search EPS APIs and start an integration (e.g.
  `/eps send money to a bank account`).
- Ask your agent to "integrate the EPS DMT API" to trigger the `integrate-eps`
  skill.
- Ask your agent to "sign an EPS request" to trigger the `sign-request` skill.
- Ask your agent to "run the DMT recipe" to trigger the `run-a-recipe` skill.

## Layout

```
.claude-plugin/plugin.json   # manifest + eps MCP wiring
skills/integrate-eps/SKILL.md
skills/sign-request/SKILL.md
skills/run-a-recipe/SKILL.md
commands/eps.md              # /eps slash command
```

Not an npm package — it ships straight from this git repo via the marketplace
manifest at the repo root.

## Notes

- Signing is **backend-only**. The `access_key` is a server-side secret and must
  never be exposed in a browser or committed to source control.
- The MCP, skills, and command all defer to the live EPS API source of truth,
  so the catalogue stays current without re-publishing the plugin.
