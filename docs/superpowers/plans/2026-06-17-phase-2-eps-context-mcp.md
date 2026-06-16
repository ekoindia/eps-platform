# Phase 2 — `@ekoindia/eps-context-mcp` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a local, stdio MCP server (`npx -y @ekoindia/eps-context-mcp`) that serves EPS API context to any MCP-capable agent via tiered/lazy, secret-free tools, with the `eps.json` bundle baked in (offline) plus an optional remote-refresh.

**Architecture:** New in-repo monorepo package `packages/eps-context-mcp/`. Pure bundle-access functions (list/search/get) + a signing-snippet generator are unit-tested; a thin server module wires them to MCP tools. The bundle is baked from the site's generated `/agent/eps.json` (Phase 0).

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk`, `zod`, `tsup` (build), `vitest`. Node ≥ 18 (global `fetch`).

**Spec:** `docs/superpowers/specs/2026-06-17-phase-2-eps-context-mcp-design.md`
**Depends on:** Phase 0 (`/agent/eps.json` + `AgentBundle` types).

---

## File Structure

- Modify `package.json` (root) — add `"workspaces": ["packages/*"]`.
- Create `packages/eps-context-mcp/package.json`, `tsconfig.json`, `tsup.config.ts`.
- Create `packages/eps-context-mcp/scripts/bake-bundle.mjs` — copy `dist/agent/eps.json` → `data/eps.json`.
- Create `packages/eps-context-mcp/src/bundle-types.ts` — local copy of the bundle types (package must not import website `@/` code).
- Create `packages/eps-context-mcp/src/load-bundle.ts` — baked import + optional `EPS_BUNDLE_URL`.
- Create `packages/eps-context-mcp/src/bundle-access.ts` — pure list/search/get/topic/recipe.
- Create `packages/eps-context-mcp/src/signing-snippets.ts` — `getSigningSnippet(language)`.
- Create `packages/eps-context-mcp/src/server.ts` — MCP server + tool registration.
- Create `packages/eps-context-mcp/src/index.ts` — stdio entry (`bin`).
- Create tests: `bundle-access.test.ts`, `signing-snippets.test.ts`, `server.test.ts`.
- Create `packages/eps-context-mcp/README.md`.

> **Boundary rule:** the package is standalone — it must NOT import from the
> website `src/`. Bundle types are duplicated in `src/bundle-types.ts` (small,
> stable). A `bundle-types.parity.test.ts` (Task 3) guards drift.

---

## Task 1: Monorepo workspace + package scaffold

**Files:**
- Modify: `package.json` (root)
- Create: `packages/eps-context-mcp/package.json`, `tsconfig.json`, `tsup.config.ts`

- [ ] **Step 1: Add workspaces to the root package.json**

In the root `package.json`, add a top-level field (alongside `"scripts"`):

```json
	"workspaces": ["packages/*"],
```

- [ ] **Step 2: Create the package manifest**

Create `packages/eps-context-mcp/package.json`:

```json
{
	"name": "@ekoindia/eps-context-mcp",
	"version": "0.1.0",
	"description": "Local MCP server giving AI coding agents context for Eko Platform Services (EPS) APIs.",
	"license": "MIT",
	"type": "module",
	"bin": { "eps-context-mcp": "./dist/index.js" },
	"files": ["dist", "data"],
	"scripts": {
		"bake": "node scripts/bake-bundle.mjs",
		"build": "tsup",
		"test": "vitest run",
		"prepublishOnly": "npm run bake && npm run build"
	},
	"dependencies": {
		"@modelcontextprotocol/sdk": "^1.0.0",
		"zod": "^3.23.0"
	},
	"devDependencies": {
		"tsup": "^8.0.0",
		"typescript": "^5.4.0",
		"vitest": "^2.0.0"
	},
	"engines": { "node": ">=18" }
}
```

> Confirm latest stable major versions at install time (`npm view <pkg> version`).
> The website's existing `zod`/`typescript`/`vitest` versions can be matched.

- [ ] **Step 3: Create tsconfig + tsup config**

Create `packages/eps-context-mcp/tsconfig.json`:

```json
{
	"compilerOptions": {
		"target": "ES2022",
		"module": "ESNext",
		"moduleResolution": "Bundler",
		"resolveJsonModule": true,
		"strict": true,
		"esModuleInterop": true,
		"skipLibCheck": true,
		"outDir": "dist"
	},
	"include": ["src", "scripts"]
}
```

Create `packages/eps-context-mcp/tsup.config.ts`:

```ts
import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm"],
	target: "node18",
	clean: true,
	// data/eps.json is read at runtime from the package dir (see load-bundle.ts);
	// keep it as a shipped asset (package.json "files"), not bundled.
});
```

- [ ] **Step 4: Install + verify the workspace resolves**

Run: `npm install`
Expected: installs without error; `npm ls -w @ekoindia/eps-context-mcp` shows the package.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json packages/eps-context-mcp/package.json packages/eps-context-mcp/tsconfig.json packages/eps-context-mcp/tsup.config.ts
git commit -m "chore(mcp): scaffold @ekoindia/eps-context-mcp workspace package"
```

---

## Task 2: Bundle baking + loader

**Files:**
- Create: `packages/eps-context-mcp/scripts/bake-bundle.mjs`
- Create: `packages/eps-context-mcp/src/bundle-types.ts`
- Create: `packages/eps-context-mcp/src/load-bundle.ts`
- Create: `packages/eps-context-mcp/data/eps.json` (baked output, committed for offline dev)

- [ ] **Step 1: Write the bake script**

Create `packages/eps-context-mcp/scripts/bake-bundle.mjs`:

```js
// Copies the site-generated bundle into the package as a shipped asset.
// Run AFTER `npm run build` at the repo root (which emits dist/agent/eps.json).
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, "../../../dist/agent/eps.json");
const destDir = path.resolve(here, "../data");
const dest = path.join(destDir, "eps.json");

const raw = await fs.readFile(src, "utf8"); // throws if the site wasn't built
JSON.parse(raw); // validate
await fs.mkdir(destDir, { recursive: true });
await fs.writeFile(dest, raw, "utf8");
console.error(`[bake] wrote ${dest}`);
```

- [ ] **Step 2: Copy the bundle types into the package**

Create `packages/eps-context-mcp/src/bundle-types.ts` — paste the EXACT contents
of `src/lib/agent/agent-bundle-types.ts` (from Phase 0), but replace the three
cross-package type imports with inlined local definitions so the package has no
`@/` dependency:

```ts
// Local, self-contained copy of the agent bundle shape. Kept in parity with
// the website's src/lib/agent/agent-bundle-types.ts (guarded by a parity test).

export interface ApiParam {
	name: string;
	label?: string;
	in: "path" | "query" | "header" | "body";
	type: string;
	required: boolean;
	description?: string;
	example?: unknown;
}
export interface ResponseField {
	name: string;
	label?: string;
	type: "string" | "number" | "boolean" | "object" | "array" | "null";
	description?: string;
	imp?: boolean;
	example?: unknown;
	children?: ResponseField[];
}
export interface ApiErrorScenario {
	scenario: string;
	statusCode?: number;
	example: Record<string, unknown>;
}
export interface ApiErrorCode {
	code: string | number;
	scope: "http" | "transaction";
	meaning: string;
}
export interface ApiKeyInfo {
	name: string;
	description: string;
}
export interface RecipeStep {
	specSlug: string;
	purpose: string;
	branches?: { onResponseStatusId: number; goto: string; note?: string }[];
}
export interface Recipe {
	id: string;
	name: string;
	summary: string;
	productId?: string;
	steps: RecipeStep[];
}

// ... then paste the remaining AgentBundle interfaces from Phase 0 verbatim:
//   AgentEnvironment, AgentBundleMeta, AgentApiIndexEntry, AgentApiDetail,
//   AgentAuthTopic, AgentErrorsTopic, AgentPricingTopic,
//   AgentEnvironmentsTopic, AgentTopics, AgentTopicId, AgentBundle, AgentIndex.
```

> The "..." line is an INSTRUCTION to paste the named interfaces from Phase 0's
> `agent-bundle-types.ts` (they already reference only the primitives defined
> above). Do not leave a literal ellipsis in the file.

- [ ] **Step 3: Write the loader**

Create `packages/eps-context-mcp/src/load-bundle.ts`:

```ts
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { AgentBundle } from "./bundle-types.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const BAKED_PATH = path.resolve(here, "../data/eps.json");

/** Load the baked bundle, or a fresh one from EPS_BUNDLE_URL when set. */
export const loadBundle = async (): Promise<{
	bundle: AgentBundle;
	source: "baked" | "remote";
}> => {
	const url = process.env.EPS_BUNDLE_URL;
	if (url) {
		try {
			const res = await fetch(url);
			if (res.ok) return { bundle: (await res.json()) as AgentBundle, source: "remote" };
		} catch {
			// fall through to baked
		}
	}
	const raw = await fs.readFile(BAKED_PATH, "utf8");
	return { bundle: JSON.parse(raw) as AgentBundle, source: "baked" };
};
```

- [ ] **Step 4: Bake the bundle (requires a site build)**

Run (from repo root): `npm run build && npm run bake -w @ekoindia/eps-context-mcp`
Expected: `packages/eps-context-mcp/data/eps.json` exists and is valid JSON.

- [ ] **Step 5: Commit**

```bash
git add packages/eps-context-mcp/scripts packages/eps-context-mcp/src/bundle-types.ts packages/eps-context-mcp/src/load-bundle.ts packages/eps-context-mcp/data/eps.json
git commit -m "feat(mcp): bake eps.json + loader with optional remote refresh"
```

---

## Task 3: Bundle access (pure) + parity guard

**Files:**
- Create: `packages/eps-context-mcp/src/bundle-access.ts`
- Test: `packages/eps-context-mcp/src/bundle-access.test.ts`
- Test: `packages/eps-context-mcp/src/bundle-types.parity.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/eps-context-mcp/src/bundle-access.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { loadBundle } from "./load-bundle.js";
import {
	getApi,
	getRecipe,
	getTopic,
	listApis,
	listRecipes,
	listTopics,
	searchApis,
} from "./bundle-access.js";

const { bundle } = await loadBundle();

describe("bundle-access", () => {
	it("listApis returns compact entries (no bodies)", () => {
		const list = listApis(bundle);
		expect(list.length).toBeGreaterThan(0);
		expect(list[0]).not.toHaveProperty("responseFields");
		expect(list[0]).toHaveProperty("slug");
	});

	it("listTopics + listRecipes return ids", () => {
		expect(listTopics(bundle)).toContain("auth");
		expect(listRecipes(bundle).some((r) => r.id === "dmt-send-money")).toBe(true);
	});

	it("searchApis ranks by query, returns ids only", () => {
		const hits = searchApis(bundle, "sender");
		expect(hits.length).toBeGreaterThan(0);
		expect(hits[0]).toHaveProperty("slug");
		expect(hits[0]).not.toHaveProperty("responseFields");
	});

	it("getApi returns detail for a known slug, undefined otherwise", () => {
		const known = bundle.apis[0].slug;
		expect(getApi(bundle, known)?.responseFields).toBeTruthy();
		expect(getApi(bundle, "nope")).toBeUndefined();
	});

	it("getTopic('auth') is backend-only; getRecipe resolves", () => {
		expect(getTopic(bundle, "auth")?.backendOnly).toBe(true);
		expect(getRecipe(bundle, "dmt-send-money")?.steps.length).toBeGreaterThan(0);
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w @ekoindia/eps-context-mcp`
Expected: FAIL — `bundle-access.js` not found.

- [ ] **Step 3: Write the implementation**

Create `packages/eps-context-mcp/src/bundle-access.ts`:

```ts
import type {
	AgentApiDetail,
	AgentApiIndexEntry,
	AgentBundle,
	AgentTopicId,
	AgentTopics,
	Recipe,
} from "./bundle-types.js";

const toIndexEntry = (a: AgentApiDetail): AgentApiIndexEntry => ({
	slug: a.slug,
	productId: a.productId,
	productName: a.productName,
	name: a.name,
	method: a.method,
	path: a.path,
	summary: a.summary,
	category: a.category,
	relevance: a.relevance,
});

export const listApis = (
	bundle: AgentBundle,
	category?: string,
): AgentApiIndexEntry[] =>
	bundle.apis
		.filter((a) => !category || a.category === category)
		.map(toIndexEntry);

export const listTopics = (bundle: AgentBundle): AgentTopicId[] =>
	Object.keys(bundle.topics) as AgentTopicId[];

export const listRecipes = (
	bundle: AgentBundle,
): { id: string; name: string; summary: string }[] =>
	bundle.recipes.map((r) => ({ id: r.id, name: r.name, summary: r.summary }));

/** Zero-dependency token scoring over the compact index fields. */
export const searchApis = (
	bundle: AgentBundle,
	query: string,
): AgentApiIndexEntry[] => {
	const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
	if (!terms.length) return listApis(bundle);
	const scored = bundle.apis.map((a) => {
		const hay = `${a.name} ${a.summary} ${a.path} ${a.category} ${a.productName}`.toLowerCase();
		let score = 0;
		for (const t of terms) if (hay.includes(t)) score += 1;
		return { a, score };
	});
	return scored
		.filter((s) => s.score > 0)
		.sort((x, y) => y.score - x.score)
		.map((s) => toIndexEntry(s.a));
};

export const getApi = (
	bundle: AgentBundle,
	slug: string,
): AgentApiDetail | undefined => bundle.apis.find((a) => a.slug === slug);

export const getTopic = <K extends AgentTopicId>(
	bundle: AgentBundle,
	topic: K,
): AgentTopics[K] | undefined => bundle.topics[topic];

export const getRecipe = (
	bundle: AgentBundle,
	id: string,
): Recipe | undefined => bundle.recipes.find((r) => r.id === id);
```

- [ ] **Step 4: Write the parity guard test**

Create `packages/eps-context-mcp/src/bundle-types.parity.test.ts`:

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Guards that the local bundle-types stays aligned with the website's source.
// Compares the AgentBundle-specific interface NAMES present in both files.
const here = path.dirname(fileURLToPath(import.meta.url));
const localSrc = readFileSync(path.join(here, "bundle-types.ts"), "utf8");
const siteSrc = readFileSync(
	path.resolve(here, "../../../src/lib/agent/agent-bundle-types.ts"),
	"utf8",
);

const NAMES = [
	"AgentEnvironment",
	"AgentBundleMeta",
	"AgentApiIndexEntry",
	"AgentApiDetail",
	"AgentAuthTopic",
	"AgentErrorsTopic",
	"AgentPricingTopic",
	"AgentEnvironmentsTopic",
	"AgentTopics",
	"AgentBundle",
	"AgentIndex",
];

describe("bundle-types parity", () => {
	it("declares every AgentBundle interface the website declares", () => {
		for (const name of NAMES) {
			expect(localSrc).toContain(`interface ${name}`);
			expect(siteSrc).toContain(`interface ${name}`);
		}
	});
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -w @ekoindia/eps-context-mcp`
Expected: PASS (both test files).

- [ ] **Step 6: Commit**

```bash
git add packages/eps-context-mcp/src/bundle-access.ts packages/eps-context-mcp/src/bundle-access.test.ts packages/eps-context-mcp/src/bundle-types.parity.test.ts
git commit -m "feat(mcp): pure bundle-access (list/search/get) + types parity guard"
```

---

## Task 4: Signing-snippet generator

**Files:**
- Create: `packages/eps-context-mcp/src/signing-snippets.ts`
- Test: `packages/eps-context-mcp/src/signing-snippets.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/eps-context-mcp/src/signing-snippets.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
	SIGNING_LANGUAGES,
	getSigningSnippet,
} from "./signing-snippets.js";

describe("getSigningSnippet", () => {
	it("supports all six languages", () => {
		expect(SIGNING_LANGUAGES).toEqual([
			"php",
			"java",
			"csharp",
			"javascript",
			"python",
			"go",
		]);
	});

	it("each snippet mentions HMAC-SHA256, base64, timestamp; never a real key", () => {
		for (const lang of SIGNING_LANGUAGES) {
			const code = getSigningSnippet(lang);
			expect(code.toLowerCase()).toContain("hmac");
			expect(code.toLowerCase()).toContain("sha256");
			expect(code.toLowerCase()).toContain("base64");
			// must not hardcode a literal access_key value
			expect(code).not.toMatch(/access[_-]?key\s*=\s*["'][A-Za-z0-9]{8,}/i);
		}
	});

	it("returns a clear error string for an unknown language", () => {
		// @ts-expect-error testing the runtime guard
		expect(getSigningSnippet("cobol")).toMatch(/unsupported language/i);
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w @ekoindia/eps-context-mcp -- signing-snippets`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `packages/eps-context-mcp/src/signing-snippets.ts`. Implements the exact
algorithm `secret-key = base64(HMAC-SHA256(message = timestamp_ms, key =
base64(access_key)))`. Backend-only; access_key comes from the caller's secret
store (shown as `getenv`/`process.env`), never hardcoded.

```ts
export const SIGNING_LANGUAGES = [
	"php",
	"java",
	"csharp",
	"javascript",
	"python",
	"go",
] as const;
export type SigningLanguage = (typeof SIGNING_LANGUAGES)[number];

const SNIPPETS: Record<SigningLanguage, string> = {
	php: `<?php
// Backend only. Never expose access_key in a browser.
$accessKey = getenv('EKO_ACCESS_KEY');
$timestamp = (string) round(microtime(true) * 1000);
$encodedKey = base64_encode($accessKey);
$secretKey = base64_encode(hash_hmac('sha256', $timestamp, $encodedKey, true));
// Send headers: developer_key, secret-key: $secretKey, secret-key-timestamp: $timestamp
`,
	java: `// Backend only. Never expose access_key in a browser.
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.util.Base64;

String accessKey = System.getenv("EKO_ACCESS_KEY");
String timestamp = String.valueOf(System.currentTimeMillis());
String encodedKey = Base64.getEncoder().encodeToString(accessKey.getBytes("UTF-8"));
Mac mac = Mac.getInstance("HmacSHA256");
mac.init(new SecretKeySpec(encodedKey.getBytes("UTF-8"), "HmacSHA256"));
String secretKey = Base64.getEncoder().encodeToString(mac.doFinal(timestamp.getBytes("UTF-8")));
`,
	csharp: `// Backend only. Never expose access_key in a browser.
using System;
using System.Security.Cryptography;
using System.Text;

string accessKey = Environment.GetEnvironmentVariable("EKO_ACCESS_KEY");
string timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString();
string encodedKey = Convert.ToBase64String(Encoding.UTF8.GetBytes(accessKey));
using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(encodedKey));
string secretKey = Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes(timestamp)));
`,
	javascript: `// Backend only (Node.js). Never expose access_key in a browser.
import crypto from "node:crypto";

const accessKey = process.env.EKO_ACCESS_KEY;
const timestamp = Date.now().toString();
const encodedKey = Buffer.from(accessKey).toString("base64");
const secretKey = crypto
	.createHmac("sha256", encodedKey)
	.update(timestamp)
	.digest("base64");
// headers: { developer_key, "secret-key": secretKey, "secret-key-timestamp": timestamp }
`,
	python: `# Backend only. Never expose access_key in a browser.
import base64, hashlib, hmac, os, time

access_key = os.environ["EKO_ACCESS_KEY"]
timestamp = str(int(time.time() * 1000))
encoded_key = base64.b64encode(access_key.encode())
secret_key = base64.b64encode(
	hmac.new(encoded_key, timestamp.encode(), hashlib.sha256).digest()
).decode()
`,
	go: `// Backend only. Never expose access_key in a browser.
package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"os"
	"time"
)

func secretKey() (string, string) {
	accessKey := os.Getenv("EKO_ACCESS_KEY")
	timestamp := fmt.Sprintf("%d", time.Now().UnixMilli())
	encodedKey := base64.StdEncoding.EncodeToString([]byte(accessKey))
	mac := hmac.New(sha256.New, []byte(encodedKey))
	mac.Write([]byte(timestamp))
	return base64.StdEncoding.EncodeToString(mac.Sum(nil)), timestamp
}
`,
};

export const getSigningSnippet = (language: string): string =>
	(SNIPPETS as Record<string, string>)[language] ??
	`Unsupported language "${language}". Supported: ${SIGNING_LANGUAGES.join(", ")}.`;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w @ekoindia/eps-context-mcp -- signing-snippets`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/eps-context-mcp/src/signing-snippets.ts packages/eps-context-mcp/src/signing-snippets.test.ts
git commit -m "feat(mcp): secret-free signing-snippet generator (6 languages)"
```

---

## Task 5: MCP server + tools + stdio entry

**Files:**
- Create: `packages/eps-context-mcp/src/server.ts`
- Create: `packages/eps-context-mcp/src/index.ts`

> Verify the SDK import subpaths at impl time. The established published package
> is `@modelcontextprotocol/sdk` with `@modelcontextprotocol/sdk/server/mcp.js`
> and `@modelcontextprotocol/sdk/server/stdio.js`. If `npm view` shows the newer
> `@modelcontextprotocol/server` split packages, adjust imports accordingly. The
> `registerTool(name, { title, description, inputSchema }, handler)` shape and
> `server.connect(transport)` are stable.

- [ ] **Step 1: Write the server factory**

Create `packages/eps-context-mcp/src/server.ts`:

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { AgentBundle } from "./bundle-types.js";
import {
	getApi,
	getRecipe,
	getTopic,
	listApis,
	listRecipes,
	listTopics,
	searchApis,
} from "./bundle-access.js";
import {
	SIGNING_LANGUAGES,
	getSigningSnippet,
} from "./signing-snippets.js";

const json = (value: unknown) => ({
	content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});

/** Build an McpServer wired to the given bundle. `source` reported by get_meta. */
export const createEpsServer = (
	bundle: AgentBundle,
	source: "baked" | "remote",
): McpServer => {
	const server = new McpServer({
		name: "eps-context-mcp",
		version: bundle.meta.bundleVersion,
	});

	server.registerTool(
		"list_apis",
		{
			title: "List EPS APIs",
			description:
				"Compact index of EPS API endpoints (no request/response bodies). Optionally filter by category.",
			inputSchema: { category: z.string().optional() },
		},
		async ({ category }) => json(listApis(bundle, category)),
	);

	server.registerTool(
		"list_topics",
		{ title: "List topics", description: "List documentation topic ids.", inputSchema: {} },
		async () => json(listTopics(bundle)),
	);

	server.registerTool(
		"list_recipes",
		{ title: "List recipes", description: "List multi-step recipe ids + names.", inputSchema: {} },
		async () => json(listRecipes(bundle)),
	);

	server.registerTool(
		"search",
		{
			title: "Search APIs",
			description: "Ranked endpoint matches for a query (ids only, no bodies).",
			inputSchema: { query: z.string() },
		},
		async ({ query }) => json(searchApis(bundle, query)),
	);

	server.registerTool(
		"get_api",
		{
			title: "Get API detail",
			description: "Full detail for one endpoint by slug.",
			inputSchema: { slug: z.string() },
		},
		async ({ slug }) => {
			const api = getApi(bundle, slug);
			return api ? json(api) : json({ error: `Unknown slug "${slug}"` });
		},
	);

	server.registerTool(
		"get_topic",
		{
			title: "Get topic",
			description: "One topic: auth | errors | pricing | environments.",
			inputSchema: { topic: z.enum(["auth", "errors", "pricing", "environments"]) },
		},
		async ({ topic }) => json(getTopic(bundle, topic)),
	);

	server.registerTool(
		"get_recipe",
		{
			title: "Get recipe",
			description: "One multi-step recipe (steps + branches) by id.",
			inputSchema: { id: z.string() },
		},
		async ({ id }) => {
			const recipe = getRecipe(bundle, id);
			return recipe ? json(recipe) : json({ error: `Unknown recipe "${id}"` });
		},
	);

	server.registerTool(
		"get_signing_snippet",
		{
			title: "Get signing snippet",
			description:
				"Paste-ready BACKEND code to compute the secret-key. Secret-free: access_key comes from your secret store.",
			inputSchema: { language: z.enum(SIGNING_LANGUAGES) },
		},
		async ({ language }) => ({
			content: [{ type: "text" as const, text: getSigningSnippet(language) }],
		}),
	);

	server.registerTool(
		"get_meta",
		{ title: "Get meta", description: "Bundle org/version + data source.", inputSchema: {} },
		async () => json({ ...bundle.meta, source }),
	);

	return server;
};
```

- [ ] **Step 2: Write the stdio entry**

Create `packages/eps-context-mcp/src/index.ts`:

```ts
#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadBundle } from "./load-bundle.js";
import { createEpsServer } from "./server.js";

async function main() {
	const { bundle, source } = await loadBundle();
	const server = createEpsServer(bundle, source);
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error(`eps-context-mcp running (bundle ${bundle.meta.bundleVersion}, ${source})`);
}

main().catch((err) => {
	console.error("eps-context-mcp fatal:", err);
	process.exit(1);
});
```

- [ ] **Step 3: Build**

Run: `npm run build -w @ekoindia/eps-context-mcp`
Expected: `dist/index.js` emitted, no type errors.

- [ ] **Step 4: Commit**

```bash
git add packages/eps-context-mcp/src/server.ts packages/eps-context-mcp/src/index.ts
git commit -m "feat(mcp): MCP server with tiered tools + stdio entry"
```

---

## Task 6: Server contract tests

**Files:**
- Test: `packages/eps-context-mcp/src/server.test.ts`

- [ ] **Step 1: Write the test (in-memory client/server pair)**

Create `packages/eps-context-mcp/src/server.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { loadBundle } from "./load-bundle.js";
import { createEpsServer } from "./server.js";

const { bundle } = await loadBundle();

const connect = async () => {
	const server = createEpsServer(bundle, "baked");
	const client = new Client({ name: "test", version: "0" });
	const [a, b] = InMemoryTransport.createLinkedPair();
	await Promise.all([server.connect(a), client.connect(b)]);
	return client;
};

const parse = (res: { content: { type: string; text?: string }[] }) =>
	JSON.parse(res.content[0].text ?? "null");

describe("eps-context-mcp tools", () => {
	it("exposes the expected tool set", async () => {
		const client = await connect();
		const names = (await client.listTools()).tools.map((t) => t.name).sort();
		expect(names).toEqual(
			[
				"get_api",
				"get_meta",
				"get_recipe",
				"get_signing_snippet",
				"get_topic",
				"list_apis",
				"list_recipes",
				"list_topics",
				"search",
			].sort(),
		);
	});

	it("list_apis returns compact entries with no bodies", async () => {
		const client = await connect();
		const res = await client.callTool({ name: "list_apis", arguments: {} });
		const list = parse(res as never);
		expect(list[0]).not.toHaveProperty("responseFields");
	});

	it("get_topic('auth') is backend-only", async () => {
		const client = await connect();
		const res = await client.callTool({ name: "get_topic", arguments: { topic: "auth" } });
		expect(parse(res as never).backendOnly).toBe(true);
	});

	it("no tool accepts an access_key parameter (secret-free)", async () => {
		const client = await connect();
		for (const t of (await client.listTools()).tools) {
			const props = (t.inputSchema as { properties?: Record<string, unknown> }).properties ?? {};
			expect(Object.keys(props)).not.toContain("access_key");
		}
	});
});
```

> If `InMemoryTransport`/`Client` import subpaths differ in the installed SDK
> version, adjust per `npm view @modelcontextprotocol/sdk` exports. Falling back
> to unit-testing the handlers directly (calling `createEpsServer` internals) is
> acceptable if the in-memory transport is unavailable.

- [ ] **Step 2: Run tests**

Run: `npm test -w @ekoindia/eps-context-mcp`
Expected: PASS (all package tests).

- [ ] **Step 3: Commit**

```bash
git add packages/eps-context-mcp/src/server.test.ts
git commit -m "test(mcp): server tool contracts + secret-free guard"
```

---

## Task 7: README + manual smoke

**Files:**
- Create: `packages/eps-context-mcp/README.md`

- [ ] **Step 1: Write the README**

Create `packages/eps-context-mcp/README.md` documenting: install (`npx -y @ekoindia/eps-context-mcp`), per-harness MCP config (Claude Code, Cursor, opencode, Continue, Codex, Gemini CLI), the tool list, the `EPS_BUNDLE_URL` env, and the secret-free/backend-only signing note.

- [ ] **Step 2: Manual smoke against a real client (optional but recommended)**

Add the server to a local MCP client config, e.g. Claude Code `mcpServers`:

```json
{ "mcpServers": { "eps": { "command": "node", "args": ["packages/eps-context-mcp/dist/index.js"] } } }
```

Confirm the tools appear and `list_apis` / `get_api` / `get_topic` respond.

- [ ] **Step 3: Commit**

```bash
git add packages/eps-context-mcp/README.md
git commit -m "docs(mcp): add eps-context-mcp README + client config"
```

---

## Final verification

- [ ] `npm test -w @ekoindia/eps-context-mcp` — all pass.
- [ ] `npm run build -w @ekoindia/eps-context-mcp` — clean.
- [ ] Root `npm run build` still succeeds (workspaces did not break the site build).
- [ ] Smoke: tools list shows 9 tools; `list_apis` has no bodies; `get_topic('auth').backendOnly === true`; no tool takes `access_key`.

## Self-Review notes (spec coverage)

- In-repo monorepo package + NPM publish config: Tasks 1, 7. ✅
- Bundle baked + `EPS_BUNDLE_URL` refresh: Task 2. ✅
- Tiered/lazy tools (list/search → get): Tasks 3, 5; lazy guarantee tested in 3 + 6. ✅
- Secret-free signing snippet, 6 languages: Tasks 4, 5; guard in 4 + 6. ✅
- Approved deps scoped to package: Task 1. ✅
- Standalone (no website import) + parity guard: Tasks 2, 3. ✅
```
