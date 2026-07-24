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
npx -y @ekoindia/eps-context-mcp@latest
```

The `@latest` tag makes `npx` re-resolve the newest published version on each
launch, so you always run the current server + API bundle without editing your
config (see [Staying up to date](#staying-up-to-date)).

The server speaks MCP over **stdio**, so it is meant to be launched by an MCP
client (see per-harness config below) rather than run by hand. It logs its
status to **stderr** and waits for an MCP client on stdin/stdout.

Requires **Node.js ≥ 18**.

## Tools

All tools are read-only and **secret-free** — none of them accept an
`access_key` or any other credential. Every tool also declares MCP annotations
(`readOnlyHint: true`, `idempotentHint: true`, `openWorldHint: false`) so
clients can see this programmatically.

| Tool                  | Arguments                                                                    | Returns                                                                                                                                            |
| --------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list_apis`           | `category?`, `limit?`                                                        | Compact index of EPS endpoints (no request/response bodies). `category` is validated against the bundle's categories; all entries by default.      |
| `list_topics`         | —                                                                            | Documentation topic ids: `auth`, `errors`, `pricing`, `environments`.                                                                              |
| `list_recipes`        | —                                                                            | Multi-step recipe ids + names (e.g. `dmt-fino-send-money`, `aeps-cash-withdrawal`).                                                                     |
| `search`              | `query`, `limit?`                                                            | Ranked endpoint matches for a query (ids only, no bodies). Top 10 by default; raise `limit` for more.                                              |
| `get_api`             | `slug`                                                                       | Full detail for one endpoint (params, response fields, errors, examples).                                                                          |
| `get_topic`           | `topic` (`auth` \| `errors` \| `pricing` \| `environments`)                  | One documentation topic.                                                                                                                           |
| `get_recipe`          | `id`                                                                         | One multi-step recipe (steps + branches).                                                                                                          |
| `get_signing_snippet` | `language` (`php` \| `java` \| `csharp` \| `javascript` \| `python` \| `go`) | Paste-ready **backend** code to compute the request `secret-key`.                                                                                  |
| `get_meta`            | —                                                                            | Bundle org/version, data source (`baked` or `remote`), this server's `packageVersion`, and `updateAvailable` (whether a newer npm release exists). |

**Tiered usage:** start with `list_apis` / `search` (cheap, compact), then call
`get_api` only for the endpoint(s) you actually need. Same pattern for
`list_topics` → `get_topic` and `list_recipes` → `get_recipe`.

**Errors are actionable:** an unknown `slug`/`id` returns an MCP error result
(`isError: true`) with "did you mean" suggestions and a pointer to
`search`/`list_apis`; an invalid `category` fails schema validation with the
valid values listed.

## Client configuration

### Claude Code

```bash
claude mcp add eps --scope project -- npx -y @ekoindia/eps-context-mcp@latest
```

`--scope project` writes a shared `.mcp.json` committed with the repo. Use
`--scope user` for every project on this machine, or drop the flag for local
scope (private to this checkout, not shared).

Or add to your MCP config (project `.mcp.json`, or `~/.claude.json` for user scope):

```json
{
	"mcpServers": {
		"eps": {
			"command": "npx",
			"args": ["-y", "@ekoindia/eps-context-mcp@latest"]
		}
	}
}
```

### Cursor

`~/.cursor/mcp.json` (or `.cursor/mcp.json` in a project):

```json
{
	"mcpServers": {
		"eps": {
			"command": "npx",
			"args": ["-y", "@ekoindia/eps-context-mcp@latest"]
		}
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
			"command": ["npx", "-y", "@ekoindia/eps-context-mcp@latest"],
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
    args: ["-y", "@ekoindia/eps-context-mcp@latest"]
```

### Codex CLI

`~/.codex/config.toml`:

```toml
[mcp_servers.eps]
command = "npx"
args = ["-y", "@ekoindia/eps-context-mcp@latest"]
```

### Gemini CLI

`~/.gemini/settings.json`:

```json
{
	"mcpServers": {
		"eps": {
			"command": "npx",
			"args": ["-y", "@ekoindia/eps-context-mcp@latest"]
		}
	}
}
```

## Staying up to date

The package is auto-published on every merge to `main`, and each publish carries
the freshest baked API bundle. To keep users current:

- **Use `@latest` in your config** (all snippets above do). `npx` then
  re-resolves the newest publish on each launch — no manual updates. Offline
  launches fall back to the npx cache; pin `@<version>` if you need a frozen
  build.
- **Update check.** On startup the server does one best-effort request to the
  npm registry (3s timeout). If a newer version is published, it logs a nudge to
  **stderr** and sets `updateAvailable` on `get_meta` — so an agent can tell you
  to switch to `@latest`. The check is silent on any failure (offline, proxy)
  and never blocks startup. Set `EPS_NO_UPDATE_CHECK=1` to disable it entirely
  (no network request).

## Configuration

### `EPS_BUNDLE_URL` (optional)

By default the server serves the bundle baked into the package. To pull a fresh
bundle at startup (e.g. the latest generated `eps.json`), set `EPS_BUNDLE_URL`:

```json
{
	"mcpServers": {
		"eps": {
			"command": "npx",
			"args": ["-y", "@ekoindia/eps-context-mcp@latest"],
			"env": { "EPS_BUNDLE_URL": "https://eps.eko.in/agent/eps.json" }
		}
	}
}
```

The remote fetch is capped at **5 seconds**; if it fails or times out for any
reason, the server transparently falls back to the baked bundle. `get_meta`
reports which source is in effect (`baked` or `remote`).

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
