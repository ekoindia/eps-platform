# EPS Claude Code plugin

A one-install [Claude Code](https://docs.claude.com/en/docs/claude-code) plugin
for integrating **Eko Platform Services (EPS)** APIs. It bundles:

- the **`eps` MCP server** (`@ekoindia/eps-context-mcp`) — searchable EPS API
  context, signing snippets, and recipes, with zero hosting and zero secrets;
- two **skills** — `integrate-eps` (end-to-end integration flow) and
  `sign-request` (backend-only HMAC-SHA256 request signing);
- the **`/eps` slash command** — search the EPS API catalogue and scaffold a
  signed call.

## Install

From the Claude Code prompt:

```
/plugin install eps@<marketplace>
```

…or add this package as a local plugin during development. Once installed,
Claude Code launches the `eps` MCP automatically via `npx -y
@ekoindia/eps-context-mcp` — no manual MCP configuration required.

## Use

- Run `/eps <query>` to search EPS APIs and start an integration (e.g.
  `/eps send money to a bank account`).
- Ask Claude to "integrate the EPS DMT API" to trigger the `integrate-eps`
  skill.
- Ask Claude to "sign an EPS request" to trigger the `sign-request` skill.

## Layout

```
.claude-plugin/plugin.json   # manifest + eps MCP wiring
skills/integrate-eps/SKILL.md
skills/sign-request/SKILL.md
commands/eps.md              # /eps slash command
```

## Notes

- Signing is **backend-only**. The `access_key` is a server-side secret and must
  never be exposed in a browser or committed to source control.
- The MCP, skills, and command all defer to the live EPS API source of truth,
  so the catalogue stays current without re-publishing the plugin.
