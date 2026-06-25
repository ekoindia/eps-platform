# @ekoindia/eps-context-mcp

A local, stdio [MCP](https://modelcontextprotocol.io) server that gives AI
coding agents accurate, up-to-date context for **Eko Platform Services (EPS)**
APIs — endpoints, request/response shapes, auth, errors, pricing, environments,
and multi-step integration recipes.

The full API bundle is **baked into the package** (works offline). No EPS
account or credentials are needed to run it. The server exposes a small set of
**tiered, lazy, secret-free** tools so an agent can list/search first and only
fetch full detail when it needs it.

## Install / run

No install step required — run it on demand with `npx`:

```bash
npx -y @ekoindia/eps-context-mcp
```

The server speaks MCP over **stdio**, so it is meant to be launched by an MCP
client (see per-harness config below) rather than run by hand. It logs its
status to **stderr** and waits for an MCP client on stdin/stdout.

Requires **Node.js ≥ 18**.

## Tools

All tools are read-only and **secret-free** — none of them accept an
`access_key` or any other credential.

| Tool | Arguments | Returns |
| --- | --- | --- |
| `list_apis` | `category?` | Compact index of EPS endpoints (no request/response bodies). Optional category filter. |
| `list_topics` | — | Documentation topic ids: `auth`, `errors`, `pricing`, `environments`. |
| `list_recipes` | — | Multi-step recipe ids + names (e.g. `dmt-send-money`, `aeps-cash-withdrawal`). |
| `search` | `query` | Ranked endpoint matches for a query (ids only, no bodies). |
| `get_api` | `slug` | Full detail for one endpoint (params, response fields, errors, examples). |
| `get_topic` | `topic` (`auth` \| `errors` \| `pricing` \| `environments`) | One documentation topic. |
| `get_recipe` | `id` | One multi-step recipe (steps + branches). |
| `get_signing_snippet` | `language` (`php` \| `java` \| `csharp` \| `javascript` \| `python` \| `go`) | Paste-ready **backend** code to compute the request `secret-key`. |
| `get_meta` | — | Bundle org/version + which data source is in use (`baked` or `remote`). |

**Tiered usage:** start with `list_apis` / `search` (cheap, compact), then call
`get_api` only for the endpoint(s) you actually need. Same pattern for
`list_topics` → `get_topic` and `list_recipes` → `get_recipe`.

## Client configuration

### Claude Code

```bash
claude mcp add eps --scope project -- npx -y @ekoindia/eps-context-mcp
```

`--scope project` writes a shared `.mcp.json` committed with the repo. Use
`--scope user` for every project on this machine, or drop the flag for local
scope (private to this checkout, not shared).

Or add to your MCP config (project `.mcp.json`, or `~/.claude.json` for user scope):

```json
{
	"mcpServers": {
		"eps": { "command": "npx", "args": ["-y", "@ekoindia/eps-context-mcp"] }
	}
}
```

### Cursor

`~/.cursor/mcp.json` (or `.cursor/mcp.json` in a project):

```json
{
	"mcpServers": {
		"eps": { "command": "npx", "args": ["-y", "@ekoindia/eps-context-mcp"] }
	}
}
```

### opencode

`opencode.json`:

```json
{
	"mcp": {
		"eps": {
			"type": "local",
			"command": ["npx", "-y", "@ekoindia/eps-context-mcp"],
			"enabled": true
		}
	}
}
```

### Continue

`~/.continue/config.yaml`:

```yaml
mcpServers:
  - name: eps
    command: npx
    args: ["-y", "@ekoindia/eps-context-mcp"]
```

### Codex CLI

`~/.codex/config.toml`:

```toml
[mcp_servers.eps]
command = "npx"
args = ["-y", "@ekoindia/eps-context-mcp"]
```

### Gemini CLI

`~/.gemini/settings.json`:

```json
{
	"mcpServers": {
		"eps": { "command": "npx", "args": ["-y", "@ekoindia/eps-context-mcp"] }
	}
}
```

## Configuration

### `EPS_BUNDLE_URL` (optional)

By default the server serves the bundle baked into the package. To pull a fresh
bundle at startup (e.g. the latest generated `eps.json`), set `EPS_BUNDLE_URL`:

```json
{
	"mcpServers": {
		"eps": {
			"command": "npx",
			"args": ["-y", "@ekoindia/eps-context-mcp"],
			"env": { "EPS_BUNDLE_URL": "https://eps.eko.in/agent/eps.json" }
		}
	}
}
```

If the fetch fails for any reason, the server transparently falls back to the
baked bundle. `get_meta` reports which source is in effect (`baked` or
`remote`).

## Security: backend-only signing

EPS requests are authenticated with a `secret-key` derived from your
`access_key` via HMAC-SHA256:

```
secret-key = base64( HMAC-SHA256( message = timestamp_ms, key = base64(access_key) ) )
```

The `get_signing_snippet` tool returns paste-ready code for this in six
languages. **This code is backend-only.**

- The `access_key` is a secret. It must live in your server-side secret store
  (the snippets read it from `process.env` / `getenv`) and must **never** be
  shipped to a browser or mobile client.
- The signing tool only emits an **algorithm template** — it never embeds a real
  key. This MCP server holds **no credentials** and performs **no signing or API
  calls** itself; it only provides context and code.

## License

MIT
