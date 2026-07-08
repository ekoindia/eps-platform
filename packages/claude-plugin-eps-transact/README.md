# EPS Transact plugin (`eps-transact`)

An agent plugin that lets AI agents **execute** Eko Platform Services (EPS)
verification APIs — PAN, Aadhaar, bank account, GSTIN, driving license, and
more — as MCP tools, using your own EPS credentials. It bundles:

- the **`eps-transact` MCP server** (`@ekoindia/eps-transact-mcp`, local stdio) —
  one typed tool per verification endpoint, credentials passed through and
  never persisted;
- the **`eps-verify` skill** — credential setup, tool selection, and
  UAT-vs-production safety rules for the agent.

Sibling plugin: [`eps`](../claude-plugin-eps/) gives coding agents dev-time API
_context_ (no credentials). This plugin runs _transactions_ at runtime.

## Install

One command, any supported agent (Claude Code, Codex, Cursor, OpenCode —
auto-detected):

```bash
npx plugins add ekoindia/eps-platform
```

…and pick **eps-transact**. Claude Code native alternative:

```
/plugin marketplace add ekoindia/eps-platform
/plugin install eps-transact@ekoindia
```

To update, re-run the same command. The MCP server itself always tracks the
newest publish (`npx -y …@latest` re-resolves at launch).

> **Requires Node ≥20.** The `@ekoindia/eps-transact-mcp` server needs Node 20+.
> On an agent running an older Node, the tools may list but calls fail at launch.

> **Codex note.** Codex (as of 0.142.5) installs the plugin's skills but does not
> yet launch its bundled stdio MCP server, so the `eps_*` tools won't appear. Until
> that's fixed upstream, add the server to Codex's native config and put the
> credentials in config (not the command, so they stay out of shell history):
>
> ```bash
> codex mcp add eps-transact -- npx -y @ekoindia/eps-transact-mcp@latest
> ```
>
> Then in `~/.codex/config.toml` under `[mcp_servers.eps-transact]` set
> `startup_timeout_sec = 30` (npx cold-start) and an `[mcp_servers.eps-transact.env]`
> table with `EKO_DEVELOPER_KEY` / `EKO_ACCESS_KEY`.

## Credentials

The stdio server connects and lists its tools even with no credentials (so the
MCP shows as connected and the `eps-verify` skill can guide you) — but a
verification **call** without credentials returns a `MISSING_CREDENTIALS` error.
It reads them from your shell environment; export them before launching your
agent:

| Variable            | Required | Notes                                                 |
| ------------------- | -------- | ----------------------------------------------------- |
| `EKO_DEVELOPER_KEY` | yes      | From your EPS account                                 |
| `EKO_ACCESS_KEY`    | yes      | Server-side secret — never commit or expose           |
| `EKO_INITIATOR_ID`  | rec.     | Optional to start; needed for most verification calls |
| `EKO_ENV`           | no       | `uat` (default) or `production` (billed!)             |
| `EKO_ALLOWED_APIS`  | no       | Comma-separated tool allowlist; `*` locally           |
| `EKO_USER_CODE`     | no       |                                                       |

GUI-launched harnesses may not inherit shell exports. In that case use the
hosted endpoint instead — `https://mcp.eko.in/transact/mcp` (streamable HTTP).
It is not a no-auth shortcut: the same credentials go in as `X-Eko-*` request
headers, so the client must support custom MCP headers. See the
[`@ekoindia/eps-transact-mcp` README](../eps-transact-mcp/README.md) for the
exact header names.

## Layout

```
.claude-plugin/plugin.json   # manifest (metadata only)
.mcp.json                    # eps-transact MCP server wiring (read by every agent)
skills/eps-verify/SKILL.md   # credential setup + verification runbook
```

Not an npm package — it ships straight from this git repo via the marketplace
manifest at the repo root.

## Notes

- **UAT by default.** Production calls are billed and hit real data; the skill
  instructs agents to get explicit user confirmation before switching.
- The MCP server never logs or persists credentials, tool arguments, or
  responses (verification traffic carries PII).
