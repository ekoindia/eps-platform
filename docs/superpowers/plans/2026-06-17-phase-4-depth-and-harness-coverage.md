# Phase 4 — Depth & Harness Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let agents develop EPS integrations offline (mock server + golden fixtures), ship a native Claude Code plugin, and generate a per-harness install matrix so developers can wire EPS into any tool.

**Architecture:** A pure fixtures builder emits request/response pairs from the bundle. A zero-dependency Node mock server replays them with recipe-aware branching. A pure install-matrix builder emits per-harness wiring. A Claude Code plugin bundles the Phase 2 MCP + skills + a slash command.

**Tech Stack:** TypeScript, `node:http` (no server deps), Vitest. Pure builders in the website `src/`, emitted by the Phase 0/1 agent vite plugin.

**Spec:** `docs/superpowers/specs/2026-06-17-phase-4-depth-and-harness-coverage-design.md`
**Depends on:** Phase 0 (bundle/recipes), Phase 1 (packs/hub), Phase 2 (MCP + monorepo).

---

## File Structure

- Create `src/lib/agent/build-fixtures.ts` (+ test) — golden request/response pairs.
- Create `src/lib/agent/build-install-matrix.ts` (+ test) — per-harness wiring.
- Modify `vite-plugin-generate-agent-bundle.ts` — emit `fixtures.json` + `install-matrix.json`.
- Create `packages/eps-mock-server/` — zero-dep Node mock server.
- Create `packages/claude-plugin-eps/` — Claude Code plugin (manifest + MCP + skills + command).
- Modify `src/pages/AgentsPage.tsx` + `src/lib/markdown/render-agents.ts` — render the install matrix.

---

## Task 1: Golden fixtures builder

**Files:**
- Create: `src/lib/agent/build-fixtures.ts`
- Test: `src/lib/agent/build-fixtures.test.ts`
- Modify: `vite-plugin-generate-agent-bundle.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/agent/build-fixtures.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { getDocumentedSpecs } from "@/lib/data/docs-registry";
import { buildAgentBundle } from "@/lib/agent/build-agent-bundle";
import { buildFixtures } from "@/lib/agent/build-fixtures";

const bundle = buildAgentBundle(getDocumentedSpecs());
const fixtures = buildFixtures(bundle);

describe("buildFixtures", () => {
	it("has one fixture per endpoint with request + success response", () => {
		expect(fixtures.length).toBe(bundle.apis.length);
		for (const f of fixtures) {
			expect(f).toHaveProperty("slug");
			expect(f).toHaveProperty("request");
			expect(f).toHaveProperty("successResponse");
		}
	});

	it("carries error scenarios keyed by response_status_id where present", () => {
		const dmt = fixtures.find((f) => f.slug === "dmt-get-sender");
		expect(dmt).toBeTruthy();
		// the 463 branch is documented for the DMT flow
		expect(Array.isArray(dmt?.errors)).toBe(true);
	});
});
```

- [ ] **Step 2: Run to verify it fails → implement**

Run: `npx vitest run src/lib/agent/build-fixtures.test.ts` → FAIL.

Create `src/lib/agent/build-fixtures.ts`:

```ts
/**
 * Pure builder for offline golden fixtures: one request/response pair per
 * endpoint (plus documented error examples). Consumed by the mock server,
 * agent evals, and SDK tests. No I/O, no Date.
 */
import type { AgentBundle } from "@/lib/agent/agent-bundle-types";

export interface EndpointFixture {
	slug: string;
	method: string;
	path: string;
	request: Record<string, unknown>;
	successResponse: Record<string, unknown>;
	errors: {
		scenario: string;
		responseStatusId?: number;
		statusCode?: number;
		example: Record<string, unknown>;
	}[];
}

export const buildFixtures = (bundle: AgentBundle): EndpointFixture[] =>
	bundle.apis.map((a) => ({
		slug: a.slug,
		method: a.method,
		path: a.path,
		request: a.sampleRequest,
		successResponse: a.sampleSuccessResponse,
		errors: a.errorScenarios.map((e) => ({
			scenario: e.scenario,
			responseStatusId:
				typeof (e.example as { response_status_id?: number }).response_status_id ===
				"number"
					? (e.example as { response_status_id: number }).response_status_id
					: undefined,
			statusCode: e.statusCode,
			example: e.example,
		})),
	}));
```

- [ ] **Step 3: Emit from the plugin + verify**

In `vite-plugin-generate-agent-bundle.ts`, load `build-fixtures.ts` and add
`files["agent/fixtures.json"] = j(fixtures.buildFixtures(bundle));`.
Run: `npx vitest run src/lib/agent/build-fixtures.test.ts` → PASS.
Run: `npm run build && cat dist/agent/fixtures.json | head -20`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/agent/build-fixtures.ts src/lib/agent/build-fixtures.test.ts vite-plugin-generate-agent-bundle.ts
git commit -m "feat(agent): emit offline golden fixtures (/agent/fixtures.json)"
```

---

## Task 2: Mock server package

**Files:**
- Create: `packages/eps-mock-server/package.json`, `tsconfig.json`, `tsup.config.ts`
- Create: `packages/eps-mock-server/scripts/bake-fixtures.mjs`
- Create: `packages/eps-mock-server/src/match.ts` (+ test)
- Create: `packages/eps-mock-server/src/server.ts`, `src/index.ts`
- Create: `packages/eps-mock-server/data/fixtures.json` (baked)

- [ ] **Step 1: Scaffold (mirror Phase 2 Task 1)**

Create `packages/eps-mock-server/package.json`:

```json
{
	"name": "@ekoindia/eps-mock-server",
	"version": "0.1.0",
	"description": "Offline mock server replaying EPS sample responses for local agent development and tests.",
	"license": "MIT",
	"type": "module",
	"bin": { "eps-mock-server": "./dist/index.js" },
	"files": ["dist", "data"],
	"scripts": {
		"bake": "node scripts/bake-fixtures.mjs",
		"build": "tsup",
		"test": "vitest run",
		"prepublishOnly": "npm run bake && npm run build"
	},
	"devDependencies": { "tsup": "^8.0.0", "typescript": "^5.4.0", "vitest": "^2.0.0" },
	"engines": { "node": ">=18" }
}
```

Create `tsconfig.json` + `tsup.config.ts` matching the MCP package (Phase 2 Task
1 Step 3). Create `scripts/bake-fixtures.mjs` copying `dist/agent/fixtures.json`
→ `packages/eps-mock-server/data/fixtures.json` (same shape as Phase 2's bake).

- [ ] **Step 2: Write the failing matcher test**

Create `packages/eps-mock-server/src/match.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { matchResponse } from "./match.js";

const fixtures = [
	{
		slug: "dmt-get-sender",
		method: "GET",
		path: "/customer/profile/{customer_id}/dmt-fino",
		request: {},
		successResponse: { status: 0, response_status_id: 0, message: "Customer found" },
		errors: [
			{
				scenario: "Sender not found",
				responseStatusId: 463,
				example: { status: 1, response_status_id: 463, message: "User not found" },
			},
		],
	},
];

describe("matchResponse", () => {
	it("matches a GET path with a path param and returns the success response", () => {
		const res = matchResponse(fixtures, "GET", "/customer/profile/9123456789/dmt-fino", {});
		expect(res?.body.response_status_id).toBe(0);
	});

	it("returns the error example when eps_scenario forces a status id", () => {
		const res = matchResponse(
			fixtures,
			"GET",
			"/customer/profile/9123456789/dmt-fino",
			{ eps_scenario: "463" },
		);
		expect(res?.body.response_status_id).toBe(463);
	});

	it("returns null for an unknown route", () => {
		expect(matchResponse(fixtures, "GET", "/nope", {})).toBeNull();
	});
});
```

- [ ] **Step 3: Run → implement the matcher**

Run: `npm test -w @ekoindia/eps-mock-server` → FAIL.

Create `packages/eps-mock-server/src/match.ts`:

```ts
export interface Fixture {
	slug: string;
	method: string;
	path: string;
	request: Record<string, unknown>;
	successResponse: Record<string, unknown>;
	errors: {
		scenario: string;
		responseStatusId?: number;
		statusCode?: number;
		example: Record<string, unknown>;
	}[];
}

/** Turn "/a/{id}/b" into a RegExp that matches "/a/123/b". */
const pathToRegExp = (path: string): RegExp =>
	new RegExp(`^${path.replace(/\{[^/]+\}/g, "[^/]+")}/?$`);

export interface MockResult {
	statusCode: number;
	body: Record<string, unknown> & { response_status_id?: number };
}

/**
 * Resolve a mock response. `query.eps_scenario=<response_status_id>` forces a
 * documented error example (recipe-aware testing, e.g. 463 → onboard branch).
 */
export const matchResponse = (
	fixtures: Fixture[],
	method: string,
	pathname: string,
	query: Record<string, string>,
): MockResult | null => {
	const fixture = fixtures.find(
		(f) => f.method === method && pathToRegExp(f.path).test(pathname),
	);
	if (!fixture) return null;

	const forced = query.eps_scenario;
	if (forced) {
		const err = fixture.errors.find((e) => String(e.responseStatusId) === forced);
		if (err)
			return { statusCode: err.statusCode ?? 200, body: err.example };
	}
	return { statusCode: 200, body: fixture.successResponse };
};
```

- [ ] **Step 4: Run matcher test → PASS, then write the server**

Run: `npm test -w @ekoindia/eps-mock-server` → PASS.

Create `packages/eps-mock-server/src/server.ts`:

```ts
import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { matchResponse, type Fixture } from "./match.js";

const here = path.dirname(fileURLToPath(import.meta.url));

export const loadFixtures = async (): Promise<Fixture[]> =>
	JSON.parse(await fs.readFile(path.resolve(here, "../data/fixtures.json"), "utf8"));

export const createMockServer = (fixtures: Fixture[]): http.Server =>
	http.createServer((req, res) => {
		const url = new URL(req.url ?? "/", "http://localhost");
		const query = Object.fromEntries(url.searchParams.entries());
		const result = matchResponse(fixtures, req.method ?? "GET", url.pathname, query);
		res.setHeader("Content-Type", "application/json");
		if (!result) {
			res.statusCode = 404;
			res.end(JSON.stringify({ status: 1, message: "No mock for this route" }));
			return;
		}
		res.statusCode = result.statusCode;
		res.end(JSON.stringify(result.body));
	});
```

Create `packages/eps-mock-server/src/index.ts`:

```ts
#!/usr/bin/env node
import { createMockServer, loadFixtures } from "./server.js";

const port = Number(process.env.PORT ?? 4010);
const fixtures = await loadFixtures();
createMockServer(fixtures).listen(port, () => {
	console.error(`eps-mock-server listening on http://localhost:${port} (${fixtures.length} endpoints)`);
});
```

- [ ] **Step 5: Bake, build, smoke**

Run (repo root): `npm run build && npm run bake -w @ekoindia/eps-mock-server && npm run build -w @ekoindia/eps-mock-server`
Smoke: `node packages/eps-mock-server/dist/index.js &` then
`curl "http://localhost:4010/customer/profile/9123456789/dmt-fino"` (success) and
`curl "http://localhost:4010/customer/profile/9123456789/dmt-fino?eps_scenario=463"` (463). Kill the server.

- [ ] **Step 6: Commit**

```bash
git add packages/eps-mock-server
git commit -m "feat(mock): offline mock server with recipe-aware branching"
```

---

## Task 3: Install-matrix builder

**Files:**
- Create: `src/lib/agent/build-install-matrix.ts`
- Test: `src/lib/agent/build-install-matrix.test.ts`
- Modify: `vite-plugin-generate-agent-bundle.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/agent/build-install-matrix.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { buildInstallMatrix, HARNESSES } from "@/lib/agent/build-install-matrix";

const matrix = buildInstallMatrix();

describe("buildInstallMatrix", () => {
	it("covers every listed harness", () => {
		expect(matrix.length).toBe(HARNESSES.length);
		const ids = matrix.map((m) => m.id);
		for (const h of ["claude-code", "cursor", "codex", "gemini-cli", "copilot", "opencode"])
			expect(ids).toContain(h);
	});

	it("each MCP-capable harness carries the npx command", () => {
		for (const m of matrix.filter((x) => x.mcp))
			expect(m.mcp).toContain("@ekoindia/eps-context-mcp");
	});

	it("each entry names a pack file or an MCP config (at least one mechanism)", () => {
		for (const m of matrix) expect(Boolean(m.mcp) || Boolean(m.packFile)).toBe(true);
	});
});
```

- [ ] **Step 2: Run → implement**

Run: `npx vitest run src/lib/agent/build-install-matrix.test.ts` → FAIL.

Create `src/lib/agent/build-install-matrix.ts`:

```ts
/**
 * Pure builder for the per-harness install matrix shown on /agents. Documents
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
	{ id: "claude-code", name: "Claude Code", mcp: MCP_CMD, packFile: "CLAUDE.md", packPlacement: "./CLAUDE.md" },
	{ id: "cursor", name: "Cursor", mcp: MCP_CMD, packFile: ".cursorrules", packPlacement: "./.cursorrules" },
	{ id: "codex", name: "Codex", mcp: MCP_CMD, packFile: "AGENTS.md", packPlacement: "./AGENTS.md" },
	{ id: "gemini-cli", name: "Gemini CLI", mcp: MCP_CMD, packFile: "AGENTS.md", packPlacement: "./GEMINI.md" },
	{ id: "opencode", name: "opencode", mcp: MCP_CMD, packFile: "AGENTS.md", packPlacement: "./AGENTS.md" },
	{ id: "continue", name: "Continue", mcp: MCP_CMD },
	{ id: "copilot", name: "GitHub Copilot", packFile: "copilot-instructions.md", packPlacement: "./.github/copilot-instructions.md" },
	{ id: "windsurf", name: "Windsurf", packFile: "AGENTS.md", packPlacement: "./.windsurfrules" },
	{ id: "cody", name: "Cody", packFile: "AGENTS.md" },
	{ id: "zed", name: "Zed", mcp: MCP_CMD, packFile: "AGENTS.md" },
	{ id: "aider", name: "aider", packFile: "AGENTS.md", packPlacement: "CONVENTIONS.md" },
	{ id: "jetbrains-ai", name: "JetBrains AI", packFile: "AGENTS.md" },
];

export const buildInstallMatrix = (): HarnessInstall[] => HARNESSES;
```

- [ ] **Step 3: Emit + verify + commit**

In `vite-plugin-generate-agent-bundle.ts`, load `build-install-matrix.ts` and add
`files["agent/install-matrix.json"] = j(matrix.buildInstallMatrix());`.
Run: `npx vitest run src/lib/agent/build-install-matrix.test.ts` → PASS; `npm run build`.

```bash
git add src/lib/agent/build-install-matrix.ts src/lib/agent/build-install-matrix.test.ts vite-plugin-generate-agent-bundle.ts
git commit -m "feat(agent): emit per-harness install matrix"
```

---

## Task 4: Claude Code plugin

**Files:**
- Create: `packages/claude-plugin-eps/` — manifest, MCP config, skills, command.

> Verify the current Claude Code plugin manifest schema before finalizing
> (`.claude-plugin/plugin.json` + `skills/<name>/SKILL.md` + `commands/*.md` +
> an MCP server declaration). The structure below is the established layout;
> adjust field names to the installed Claude Code version if they differ.

- [ ] **Step 1: Plugin manifest + MCP wiring**

Create `packages/claude-plugin-eps/.claude-plugin/plugin.json`:

```json
{
	"name": "eps",
	"description": "Eko Platform Services — context MCP, skills, and commands for integrating EPS APIs.",
	"version": "0.1.0",
	"mcpServers": {
		"eps": { "command": "npx", "args": ["-y", "@ekoindia/eps-context-mcp"] }
	}
}
```

- [ ] **Step 2: Skill — integrate-eps**

Create `packages/claude-plugin-eps/skills/integrate-eps/SKILL.md`:

```markdown
---
name: integrate-eps
description: Use when integrating an Eko Platform Services (EPS) API — looks up the endpoint via the eps MCP, explains backend-only HMAC signing, and scaffolds a signed request.
---

# Integrate an EPS API

1. Use the `eps` MCP `search`/`list_apis` to find the endpoint, then `get_api` for detail.
2. Read `get_topic('auth')` — signing is backend-only; never expose `access_key`.
3. Use `get_signing_snippet(language)` for paste-ready signing code.
4. For multi-step flows, fetch `get_recipe(id)` (e.g. `dmt-send-money`).
5. Prefer the `@ekoindia/eps-sdk` thin client when the user's stack is Node/PHP.
```

- [ ] **Step 3: Skill — sign-request**

Create `packages/claude-plugin-eps/skills/sign-request/SKILL.md`:

```markdown
---
name: sign-request
description: Use when computing or debugging the EPS secret-key / request signature — emits backend-only HMAC-SHA256 signing code and explains the header set.
---

# Sign an EPS request (backend only)

`secret-key = base64(HMAC-SHA256(timestamp_ms, base64(access_key)))`.
Headers: `developer_key`, `secret-key`, `secret-key-timestamp`, `content-type`.
Never compute this in a browser — `access_key` is a server-side secret.
Use the `eps` MCP `get_signing_snippet(language)` for the exact code.
```

- [ ] **Step 4: Slash command — /eps**

Create `packages/claude-plugin-eps/commands/eps.md`:

```markdown
---
description: Search EPS APIs and start an integration
---

Use the `eps` MCP to search for the API matching: $ARGUMENTS

List the top matches (`search`), then `get_api` the best one and outline a
backend-only signed call, citing the auth topic.
```

- [ ] **Step 5: README + verify load**

Create `packages/claude-plugin-eps/README.md` (install instructions). Load the
plugin locally in Claude Code and confirm: the `eps` MCP connects, the two
skills appear, `/eps <query>` runs.

- [ ] **Step 6: Commit**

```bash
git add packages/claude-plugin-eps
git commit -m "feat(plugin): Claude Code plugin bundling EPS MCP + skills + command"
```

---

## Task 5: Render install matrix on the hub + final

**Files:**
- Modify: `src/pages/AgentsPage.tsx`, `src/lib/markdown/render-agents.ts`

- [ ] **Step 1: Render the matrix**

In `src/pages/AgentsPage.tsx`, import `buildInstallMatrix` and render a table
(Harness · MCP command · Pack file · Placement). Mirror it in
`render-agents.ts` using `markdownTable`. Add the mock server install
(`npx -y @ekoindia/eps-mock-server`) and the Claude Code plugin entry.

- [ ] **Step 2: Verify + commit**

Run: `npx vitest run && npm run lint && npm run build`
Expected: pass; `dist/agent/{fixtures.json,install-matrix.json}` present; `/agents` shows the matrix.

```bash
git add src/pages/AgentsPage.tsx src/lib/markdown/render-agents.ts
git commit -m "feat(agent): render install matrix + mock/plugin on the hub"
```

---

## Final verification

- [ ] `npm test -w @ekoindia/eps-mock-server` — matcher tests pass.
- [ ] Mock smoke: success + `?eps_scenario=463` branch return the right bodies.
- [ ] `npx vitest run` (website) — fixtures + install-matrix builders pass.
- [ ] Claude Code plugin loads: MCP connects, skills + `/eps` available.
- [ ] `npm run build` emits `fixtures.json` + `install-matrix.json`.

## Self-Review notes (spec coverage)

- Mock server + golden fixtures, recipe-aware, offline/no-proxy: Tasks 1, 2. ✅
- Claude Code plugin = MCP + skills + command: Task 4. ✅
- Generated per-harness install matrix (CC + the rest): Tasks 3, 5. ✅
- Recipe surfacing (derivative — MCP `get_recipe` from Phase 2; READMEs/hub examples): Tasks 4, 5. ✅
- Coverage model documented on the hub: Task 5. ✅
```
