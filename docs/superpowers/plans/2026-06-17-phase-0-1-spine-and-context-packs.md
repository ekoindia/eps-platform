# Phase 0 + 1 — Spine & Context Packs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-generate, from `api-specs.ts`, a canonical agent bundle (`/agent/eps.json` + split slices), a recipes data layer, agent context packs (`AGENTS.md`/`CLAUDE.md`/`.cursorrules`/copilot), an extended `llms.txt`, and a `/agents` portal hub.

**Architecture:** Mirror the existing `pure data → vite plugin → static artifact` pattern (`build-openapi.ts` + `vite-plugin-generate-openapi.ts`). New pure builders in `src/lib/agent/` consume the spec layer + a new `src/lib/data/api-recipes.ts`. A new vite plugin emits the JSON + packs into the build output. A new SSG page `/agents` is wired into routes/nav/search.

**Tech Stack:** TypeScript, Vite, Vitest, React, React Router. Pure/deterministic builders (no `Date`, no I/O) like `build-openapi.ts`.

**Spec:** `docs/superpowers/specs/2026-06-17-phase-0-1-spine-and-context-packs-design.md`

---

## File Structure

**Phase 0 (spine):**
- Create `src/lib/data/api-recipes.ts` — recipe types + `RECIPES` (2 exemplars) + `assertRecipeSlugs`.
- Create `src/lib/data/api-recipes.test.ts` — recipe ref validation.
- Create `src/lib/agent/agent-bundle-types.ts` — `AgentBundle` + sub-types.
- Create `src/lib/agent/build-agent-bundle.ts` — `buildAgentBundle`, `buildIndex`, `buildApi`, `buildTopic`.
- Create `src/lib/agent/build-agent-bundle.test.ts`.
- Create `vite-plugin-generate-agent-bundle.ts` — emit `/agent/*.json`.
- Modify `vite.config.ts` — register the plugin.

**Phase 1 (packs + hub):**
- Create `src/lib/agent/build-context-pack.ts` — canonical body + per-target wrappers + `CONTEXT_PACK_FILES`.
- Create `src/lib/agent/build-context-pack.test.ts`.
- Modify `vite-plugin-generate-agent-bundle.ts` — also emit the packs.
- Modify `src/lib/markdown/render-index.ts` — add an "AI coding agents" section to `renderLlmsTxt`.
- Create `src/lib/markdown/render-agents.ts` — `/agents.md` renderer.
- Modify `vite-plugin-generate-markdown.ts` — emit `/agents.md`.
- Create `src/pages/AgentsPage.tsx` — hub page.
- Modify `src/App.tsx`, `ssg/routes.ts`, `src/lib/search-index.ts`, `src/components/Header.tsx`.

---

# PHASE 0 — Spine

## Task 1: Recipes data layer

**Files:**
- Create: `src/lib/data/api-recipes.ts`
- Test: `src/lib/data/api-recipes.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/data/api-recipes.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { API_SPECS } from "@/lib/data/api-specs";
import { RECIPES, assertRecipeSlugs } from "@/lib/data/api-recipes";

describe("api-recipes", () => {
	it("ships at least the two exemplar recipes", () => {
		const ids = RECIPES.map((r) => r.id);
		expect(ids).toContain("dmt-send-money");
		expect(ids).toContain("aeps-cash-withdrawal");
	});

	it("every step references a real spec slug", () => {
		const known = new Set(API_SPECS.map((s) => s.slug));
		for (const recipe of RECIPES) {
			for (const step of recipe.steps) {
				expect(known.has(step.specSlug)).toBe(true);
				for (const branch of step.branches ?? []) {
					if (branch.goto !== "done")
						expect(known.has(branch.goto)).toBe(true);
				}
			}
		}
	});

	it("assertRecipeSlugs throws on an unknown slug", () => {
		expect(() =>
			assertRecipeSlugs(
				[
					{
						id: "bad",
						name: "Bad",
						summary: "x",
						steps: [{ specSlug: "does-not-exist", purpose: "x" }],
					},
				],
				new Set(["dmt-get-sender"]),
			),
		).toThrow(/unknown spec slug/i);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/data/api-recipes.test.ts`
Expected: FAIL — cannot import `RECIPES`/`assertRecipeSlugs` (module not found).

- [ ] **Step 3: Write the implementation**

Create `src/lib/data/api-recipes.ts`:

```ts
/**
 * Machine-readable multi-step API "recipes" (runbooks) for Eko's REST APIs.
 *
 * These encode the conditional, multi-call flows that the per-endpoint
 * descriptions in `api-specs.ts` already imply (e.g. DMT: if the sender is not
 * found, onboard them first). They are consumed by the agent bundle, context
 * packs, the MCP, and SDK examples — never duplicated downstream.
 *
 * `specSlug` and branch `goto` targets are foreign keys into `API_SPECS.slug`;
 * `assertRecipeSlugs` fails the build/tests on any dangling reference.
 */

/** One step in a recipe; a call to a single documented endpoint. */
export interface RecipeStep {
	/** FK into `API_SPECS.slug`. */
	specSlug: string;
	/** Why this step exists in the flow. */
	purpose: string;
	/** Conditional jumps keyed on the response's `response_status_id`. */
	branches?: {
		onResponseStatusId: number;
		/** A spec slug to jump to, or "done" to end the flow. */
		goto: string;
		note?: string;
	}[];
}

/** A named, multi-step flow across several endpoints. */
export interface Recipe {
	id: string;
	name: string;
	summary: string;
	/** Optional FK into `API_PRODUCTS.id`. */
	productId?: string;
	steps: RecipeStep[];
}

export const RECIPES: Recipe[] = [
	{
		id: "dmt-send-money",
		name: "DMT — Send Money",
		summary:
			"Full domestic money transfer flow: look up the sender, onboard them if new, add the recipient, then send an OTP-verified transfer.",
		productId: "dmt",
		steps: [
			{
				specSlug: "dmt-get-sender",
				purpose:
					"Check whether the customer is already a registered DMT sender.",
				branches: [
					{
						onResponseStatusId: 463,
						goto: "dmt-onboard-sender",
						note: "Sender not found — onboard them before continuing.",
					},
				],
			},
			{
				specSlug: "dmt-onboard-sender",
				purpose: "Register a new sender when Get Sender returned 463.",
			},
			{
				specSlug: "dmt-add-recipient",
				purpose: "Add the beneficiary the sender wants to transfer to.",
			},
			{
				specSlug: "dmt-send-otp",
				purpose: "Trigger the transaction OTP sent to the sender.",
			},
			{
				specSlug: "dmt-initiate-transfer",
				purpose: "Submit the OTP-verified transfer to complete the flow.",
				branches: [{ onResponseStatusId: 0, goto: "done" }],
			},
		],
	},
	{
		id: "aeps-cash-withdrawal",
		name: "AePS — Cash Withdrawal",
		summary:
			"Aadhaar-enabled cash withdrawal: one-time agent activation, daily 2FA, then the biometric withdrawal.",
		productId: "aeps",
		steps: [
			{
				specSlug: "aeps-activate-fingpay",
				purpose: "One-time activation of AePS Fingpay for the agent.",
			},
			{
				specSlug: "aeps-daily-auth",
				purpose: "Daily two-factor authentication required before transacting.",
			},
			{
				specSlug: "aeps-cash-withdrawal",
				purpose: "Perform the biometric Aadhaar-enabled cash withdrawal.",
				branches: [{ onResponseStatusId: 0, goto: "done" }],
			},
		],
	},
];

/** Throws if any recipe step (or branch target) references an unknown slug. */
export const assertRecipeSlugs = (
	recipes: Recipe[],
	knownSlugs: ReadonlySet<string>,
): void => {
	for (const recipe of recipes) {
		for (const step of recipe.steps) {
			if (!knownSlugs.has(step.specSlug)) {
				throw new Error(
					`api-recipes: recipe "${recipe.id}" references unknown spec slug "${step.specSlug}".`,
				);
			}
			for (const branch of step.branches ?? []) {
				if (branch.goto !== "done" && !knownSlugs.has(branch.goto)) {
					throw new Error(
						`api-recipes: recipe "${recipe.id}" branch references unknown spec slug "${branch.goto}".`,
					);
				}
			}
		}
	}
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/data/api-recipes.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/api-recipes.ts src/lib/data/api-recipes.test.ts
git commit -m "feat(agent): add api recipes data layer with 2 exemplars"
```

---

## Task 2: Agent bundle types

**Files:**
- Create: `src/lib/agent/agent-bundle-types.ts`

No test (types only); exercised by Task 3/4.

- [ ] **Step 1: Write the types**

Create `src/lib/agent/agent-bundle-types.ts`:

```ts
/**
 * Shape of the canonical agent bundle (`/agent/eps.json`) and its split slices.
 *
 * This is the single machine-readable artifact every downstream agent feature
 * (MCP, context packs, SDKs) consumes. It is assembled by `build-agent-bundle.ts`
 * from the spec layer + `api-recipes.ts`, and is pure/deterministic.
 */
import type {
	ApiErrorScenario,
	ApiParam,
	ResponseField,
} from "@/lib/data/api-specs-common";
import type { ApiErrorCode } from "@/lib/data/api-error-codes";
import type { ApiKeyInfo } from "@/lib/data/api-auth";
import type { Recipe } from "@/lib/data/api-recipes";

export interface AgentEnvironment {
	id: string;
	label: string;
	baseUrl: string;
	note?: string;
}

export interface AgentBundleMeta {
	org: string;
	apiVersion: string;
	/** Deterministic content hash of `{ topics, apis, recipes }` (no Date). */
	bundleVersion: string;
	environments: AgentEnvironment[];
}

/** Compact, body-free entry used by the index slice. */
export interface AgentApiIndexEntry {
	slug: string;
	productId: string;
	productName: string;
	name: string;
	method: string;
	path: string;
	summary: string;
	category: string;
	relevance?: string;
}

/** Full per-endpoint detail (the `api/<slug>.json` slice). */
export interface AgentApiDetail extends AgentApiIndexEntry {
	description?: string;
	bestFor?: string;
	docsUrl: string;
	financial?: boolean;
	headers: ApiParam[];
	requestParams: ApiParam[];
	sampleRequest: Record<string, unknown>;
	responseFields: ResponseField[];
	sampleSuccessResponse: Record<string, unknown>;
	errorScenarios: ApiErrorScenario[];
}

export interface AgentAuthTopic {
	id: "auth";
	backendOnly: true;
	warning: string;
	docsUrl: string;
	keys: ApiKeyInfo[];
	headers: ApiParam[];
	secretKeyGeneration: string[];
}

export interface AgentErrorsTopic {
	id: "errors";
	docsUrl: string;
	codes: ApiErrorCode[];
}

export interface AgentPricingTopic {
	id: "pricing";
	summary: string;
	links: { label: string; url: string }[];
}

export interface AgentEnvironmentsTopic {
	id: "environments";
	environments: AgentEnvironment[];
}

export interface AgentTopics {
	auth: AgentAuthTopic;
	errors: AgentErrorsTopic;
	pricing: AgentPricingTopic;
	environments: AgentEnvironmentsTopic;
}

export type AgentTopicId = keyof AgentTopics;

export interface AgentBundle {
	meta: AgentBundleMeta;
	topics: AgentTopics;
	apis: AgentApiDetail[];
	recipes: Recipe[];
}

/** Index slice: compact lists only, no full bodies. */
export interface AgentIndex {
	meta: AgentBundleMeta;
	apis: AgentApiIndexEntry[];
	topics: AgentTopicId[];
	recipes: { id: string; name: string; summary: string }[];
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors from this file (pre-existing unrelated errors, if any, are out of scope — re-run after Task 3).

- [ ] **Step 3: Commit**

```bash
git add src/lib/agent/agent-bundle-types.ts
git commit -m "feat(agent): add agent bundle type definitions"
```

---

## Task 3: Bundle builder

**Files:**
- Create: `src/lib/agent/build-agent-bundle.ts`
- Test: `src/lib/agent/build-agent-bundle.test.ts` (Task 4)

- [ ] **Step 1: Write the implementation**

Create `src/lib/agent/build-agent-bundle.ts`:

```ts
/**
 * Builds the canonical agent bundle (`/agent/eps.json`) + split slices from the
 * spec layer and `api-recipes.ts`.
 *
 * Pure + deterministic (no I/O, no Date) like `build-openapi.ts`, so it
 * unit-tests cleanly and produces byte-stable output for a given spec set.
 */
import { API_DEFAULT_VERSION, SITE_URL } from "@/lib/config/site";
import {
	API_AUTH_DOCS_URL,
	API_AUTH_INFO,
	API_ENVIRONMENTS,
} from "@/lib/data/api-auth";
import {
	ALL_ERROR_CODES,
	API_ERROR_CODES_DOCS_URL,
} from "@/lib/data/api-error-codes";
import { ACTIVE_PRODUCTS_MAP } from "@/lib/data/api-products";
import { RECIPES, assertRecipeSlugs } from "@/lib/data/api-recipes";
import type { ApiSpec } from "@/lib/data/api-specs-common";
import {
	resolveHeaders,
	resolveRequestParams,
	resolveResponseFields,
} from "@/lib/data/api-specs-common";
import type {
	AgentApiDetail,
	AgentApiIndexEntry,
	AgentBundle,
	AgentEnvironment,
	AgentIndex,
	AgentTopicId,
	AgentTopics,
} from "@/lib/agent/agent-bundle-types";

const BACKEND_ONLY_WARNING =
	"Backend-only. The access_key is a server-side secret used to compute the " +
	"per-request secret-key (HMAC-SHA256). Never expose access_key or compute " +
	"secret-key in a browser/frontend.";

const ENVIRONMENTS: AgentEnvironment[] = [
	{ id: "sandbox", ...API_ENVIRONMENTS.sandbox },
	{ id: "production", ...API_ENVIRONMENTS.production },
];

/** Deterministic 32-bit FNV-1a hash (hex) — no crypto/Date dependency. */
const fnv1aHex = (input: string): string => {
	let h = 0x811c9dc5;
	for (let i = 0; i < input.length; i++) {
		h ^= input.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return (h >>> 0).toString(16).padStart(8, "0");
};

const productNameFor = (spec: ApiSpec): string =>
	ACTIVE_PRODUCTS_MAP[spec.productId]?.name ?? spec.productId;

const indexEntry = (spec: ApiSpec): AgentApiIndexEntry => ({
	slug: spec.slug,
	productId: spec.productId,
	productName: productNameFor(spec),
	name: spec.name,
	method: spec.method,
	path: spec.path,
	summary: spec.summary,
	category: spec.category,
	relevance: spec.relevance,
});

const apiDetail = (spec: ApiSpec): AgentApiDetail => ({
	...indexEntry(spec),
	description: spec.description,
	bestFor: spec.bestFor,
	docsUrl: spec.docsUrl,
	financial: spec.financial,
	headers: resolveHeaders(),
	requestParams: resolveRequestParams(spec),
	sampleRequest: spec.sampleRequest,
	responseFields: resolveResponseFields(spec),
	sampleSuccessResponse: spec.sampleSuccessResponse,
	errorScenarios: spec.errorScenarios ?? [],
});

const buildTopics = (): AgentTopics => ({
	auth: {
		id: "auth",
		backendOnly: true,
		warning: BACKEND_ONLY_WARNING,
		docsUrl: API_AUTH_DOCS_URL,
		keys: API_AUTH_INFO.keys,
		headers: resolveHeaders(),
		secretKeyGeneration: [...API_AUTH_INFO.secretKeyGeneration],
	},
	errors: {
		id: "errors",
		docsUrl: API_ERROR_CODES_DOCS_URL,
		codes: ALL_ERROR_CODES,
	},
	pricing: {
		id: "pricing",
		summary:
			"Per-transaction rates for all products. See the rate card and the " +
			"offline calculator for exact slabs.",
		links: [
			{ label: "Rate card (markdown)", url: `${SITE_URL}/pricing.md` },
			{
				label: "Offline calculator (xlsx)",
				url: `${SITE_URL}/eps-pricing-calculator.xlsx`,
			},
		],
	},
	environments: { id: "environments", environments: ENVIRONMENTS },
});

/**
 * Build the full agent bundle. Callers should pass the documented set
 * (`getDocumentedSpecs()`).
 */
export const buildAgentBundle = (specs: ApiSpec[]): AgentBundle => {
	assertRecipeSlugs(RECIPES, new Set(specs.map((s) => s.slug)));

	const topics = buildTopics();
	const apis = specs.map(apiDetail);
	const recipes = RECIPES;

	const hashInput = JSON.stringify({ topics, apis, recipes });
	const meta = {
		org: "ekoindia",
		apiVersion: API_DEFAULT_VERSION,
		bundleVersion: fnv1aHex(hashInput),
		environments: ENVIRONMENTS,
	};

	return { meta, topics, apis, recipes };
};

/** Compact index slice — no full bodies. */
export const buildIndex = (bundle: AgentBundle): AgentIndex => ({
	meta: bundle.meta,
	apis: bundle.apis.map(
		({ slug, productId, productName, name, method, path, summary, category, relevance }) => ({
			slug,
			productId,
			productName,
			name,
			method,
			path,
			summary,
			category,
			relevance,
		}),
	),
	topics: Object.keys(bundle.topics) as AgentTopicId[],
	recipes: bundle.recipes.map((r) => ({
		id: r.id,
		name: r.name,
		summary: r.summary,
	})),
});

/** One endpoint's full detail, or undefined for an unknown slug. */
export const buildApi = (
	bundle: AgentBundle,
	slug: string,
): AgentApiDetail | undefined => bundle.apis.find((a) => a.slug === slug);

/** One topic by id. */
export const buildTopic = <K extends AgentTopicId>(
	bundle: AgentBundle,
	topic: K,
): AgentTopics[K] => bundle.topics[topic];
```

- [ ] **Step 2: Commit (implementation; test next)**

```bash
git add src/lib/agent/build-agent-bundle.ts
git commit -m "feat(agent): add pure agent-bundle builder + slice helpers"
```

---

## Task 4: Bundle builder tests

**Files:**
- Test: `src/lib/agent/build-agent-bundle.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/agent/build-agent-bundle.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { getDocumentedSpecs } from "@/lib/data/docs-registry";
import {
	buildAgentBundle,
	buildApi,
	buildIndex,
	buildTopic,
} from "@/lib/agent/build-agent-bundle";

const specs = getDocumentedSpecs();
const bundle = buildAgentBundle(specs);

describe("buildAgentBundle", () => {
	it("is deterministic / byte-stable for a fixed spec set", () => {
		const a = JSON.stringify(buildAgentBundle(specs));
		const b = JSON.stringify(buildAgentBundle(specs));
		expect(a).toBe(b);
	});

	it("includes every documented spec in apis", () => {
		expect(bundle.apis.length).toBe(specs.length);
		for (const s of specs)
			expect(bundle.apis.some((a) => a.slug === s.slug)).toBe(true);
	});

	it("auth topic is backend-only and carries signing steps", () => {
		const auth = buildTopic(bundle, "auth");
		expect(auth.backendOnly).toBe(true);
		expect(auth.warning).toMatch(/backend-only/i);
		expect(auth.secretKeyGeneration.length).toBeGreaterThan(0);
	});

	it("never leaks an access_key value anywhere in the bundle", () => {
		const json = JSON.stringify(bundle).toLowerCase();
		// the literal header name access_key may appear in prose, but no value;
		// guard against an accidental "access_key":"<something>" assignment.
		expect(json).not.toMatch(/"access_key"\s*:/);
	});

	it("meta carries org + a content-hash bundleVersion", () => {
		expect(bundle.meta.org).toBe("ekoindia");
		expect(bundle.meta.bundleVersion).toMatch(/^[0-9a-f]{8}$/);
	});
});

describe("slices", () => {
	it("index is compact: entries have no request/response bodies", () => {
		const index = buildIndex(bundle);
		expect(index.apis.length).toBe(specs.length);
		for (const entry of index.apis) {
			expect(entry).not.toHaveProperty("responseFields");
			expect(entry).not.toHaveProperty("sampleRequest");
		}
		expect(index.topics).toContain("auth");
		expect(index.recipes.some((r) => r.id === "dmt-send-money")).toBe(true);
	});

	it("buildApi returns full detail for a known slug and undefined otherwise", () => {
		const known = specs[0].slug;
		expect(buildApi(bundle, known)?.responseFields.length).toBeGreaterThan(0);
		expect(buildApi(bundle, "nope-not-real")).toBeUndefined();
	});
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run src/lib/agent/build-agent-bundle.test.ts`
Expected: PASS (all). If the access_key guard fails, inspect which spec assigns an `access_key` value and exclude/redact it in `apiDetail`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/agent/build-agent-bundle.test.ts
git commit -m "test(agent): cover agent-bundle builder + slices"
```

---

## Task 5: Emit plugin (bundle + slices)

**Files:**
- Create: `vite-plugin-generate-agent-bundle.ts`
- Modify: `vite.config.ts`

Mirror `vite-plugin-generate-openapi.ts` exactly (configResolved + configureServer middleware + closeBundle SSR load + write).

- [ ] **Step 1: Write the plugin**

Create `vite-plugin-generate-agent-bundle.ts`:

```ts
import { promises as fs } from "node:fs";
import path from "node:path";

import {
	createServer,
	type Plugin,
	type ResolvedConfig,
	type ViteDevServer,
} from "vite";

/** Build the full bundle + split slices as a path→json map. */
async function buildFiles(
	server: Pick<ViteDevServer, "ssrLoadModule">,
): Promise<Record<string, string>> {
	const [registry, builder] = await Promise.all([
		server.ssrLoadModule("/src/lib/data/docs-registry.ts"),
		server.ssrLoadModule("/src/lib/agent/build-agent-bundle.ts"),
	]);
	const specs = registry.getDocumentedSpecs();
	const bundle = builder.buildAgentBundle(specs);

	const files: Record<string, string> = {};
	const j = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`;

	files["agent/eps.json"] = j(bundle);
	files["agent/index.json"] = j(builder.buildIndex(bundle));
	for (const api of bundle.apis)
		files[`agent/api/${api.slug}.json`] = j(builder.buildApi(bundle, api.slug));
	for (const topic of Object.keys(bundle.topics))
		files[`agent/topic/${topic}.json`] = j(builder.buildTopic(bundle, topic));

	return files;
}

export function generateAgentBundlePlugin(): Plugin {
	let resolvedConfig: ResolvedConfig | undefined;

	return {
		name: "eko:generate-agent-bundle",
		configResolved(c) {
			resolvedConfig = c;
		},
		configureServer(server) {
			server.middlewares.use(async (req, res, next) => {
				const url = req.url?.split("?")[0] ?? "";
				if (!url.startsWith("/agent/") || !url.endsWith(".json")) {
					next();
					return;
				}
				try {
					const files = await buildFiles(server);
					const key = url.slice(1); // strip leading "/"
					const body = files[key];
					if (body === undefined) {
						next();
						return;
					}
					res.statusCode = 200;
					res.setHeader("Content-Type", "application/json; charset=utf-8");
					res.setHeader("Cache-Control", "no-cache");
					res.end(body);
				} catch (err) {
					server.config.logger.error(
						`[eko:agent-bundle] ${(err as Error).message}`,
					);
					next(err);
				}
			});
		},
		async closeBundle() {
			if (!resolvedConfig) return;
			const outDir = resolvedConfig.build.outDir;
			const server = await createServer({
				configFile: false,
				appType: "custom",
				server: { middlewareMode: true },
				logLevel: "error",
			});
			try {
				const files = await buildFiles(server);
				for (const [rel, body] of Object.entries(files)) {
					const file = path.join(outDir, rel);
					await fs.mkdir(path.dirname(file), { recursive: true });
					await fs.writeFile(file, body, "utf8");
				}
				resolvedConfig.logger.info(
					`[eko:agent-bundle] wrote ${Object.keys(files).length} files to /agent`,
				);
			} finally {
				await server.close();
			}
		},
	};
}
```

> NOTE: confirm the `createServer`/`closeBundle` shape against the current
> `vite-plugin-generate-openapi.ts` and copy its exact SSR-server setup if it
> differs (e.g. extra `createServer` options). The data-loading + write logic
> above is the part that must match.

- [ ] **Step 2: Register in vite.config.ts**

In `vite.config.ts`, add the import next to the other plugin imports (near line 9-12):

```ts
import { generateAgentBundlePlugin } from "./vite-plugin-generate-agent-bundle";
```

And add it to the `plugins` array immediately after `generateOpenApiPlugin()` (line ~30):

```ts
		generateOpenApiPlugin(),
		generateAgentBundlePlugin(),
```

- [ ] **Step 3: Build and verify the artifacts**

Run: `npm run build`
Then: `ls dist/agent && ls dist/agent/api | head && cat dist/agent/index.json | head -20`
Expected: `eps.json`, `index.json`, `api/` (one file per documented spec), `topic/` (auth, errors, pricing, environments). `index.json` shows compact entries.

- [ ] **Step 4: Commit**

```bash
git add vite-plugin-generate-agent-bundle.ts vite.config.ts
git commit -m "feat(agent): emit /agent/eps.json + split slices at build"
```

---

# PHASE 1 — Context Packs & Hub

## Task 6: Context-pack builder

**Files:**
- Create: `src/lib/agent/build-context-pack.ts`
- Test: `src/lib/agent/build-context-pack.test.ts` (Task 7)

- [ ] **Step 1: Write the implementation**

Create `src/lib/agent/build-context-pack.ts`:

```ts
/**
 * Builds the agent context packs from the agent bundle: one canonical, lean
 * markdown body + thin per-target wrappers (AGENTS.md, CLAUDE.md, .cursorrules,
 * Copilot instructions). DRY — the body is authored once; wrappers only add a
 * format-appropriate shell.
 *
 * "Lean": inline only the get-it-wrong essentials (auth/HMAC signing +
 * backend-only warning, environments, error model) plus a COMPACT endpoint
 * index. Per-endpoint detail is linked (bundle/MCP/.md docs), not inlined.
 */
import { SITE_URL } from "@/lib/config/site";
import { markdownTable } from "@/lib/markdown/shared";
import type { AgentBundle } from "@/lib/agent/agent-bundle-types";

const MCP_PACKAGE = "@ekoindia/eps-context-mcp";

/** The canonical, format-neutral pack body (GitHub-flavored markdown). */
export const buildContextPackBody = (bundle: AgentBundle): string => {
	const { topics, apis, recipes, meta } = bundle;
	const lines: string[] = [];

	lines.push("# Integrating Eko Platform Services (EPS) APIs");
	lines.push("");
	lines.push(
		"EPS is an API platform for payments, banking-correspondent services " +
			"(AePS, DMT, BBPS) and identity verification (PAN, Aadhaar, bank, GST, " +
			"etc.) in India. This pack tells an AI coding agent how to call EPS APIs " +
			"correctly.",
	);
	lines.push("");

	// Environments
	lines.push("## Environments");
	lines.push("");
	lines.push(
		markdownTable(
			["Environment", "Base URL", "Notes"],
			meta.environments.map((e) => [e.label, e.baseUrl, e.note ?? ""]),
		),
	);
	lines.push("");

	// Auth & signing — inlined, backend-only
	lines.push("## Authentication & request signing");
	lines.push("");
	lines.push(`> **${topics.auth.warning}**`);
	lines.push("");
	lines.push("Every request sends these headers:");
	lines.push("");
	lines.push(
		markdownTable(
			["Header", "Description"],
			topics.auth.headers.map((h) => [h.name, h.description ?? ""]),
		),
	);
	lines.push("");
	lines.push("Compute `secret-key` (server-side) as:");
	lines.push("");
	for (let i = 0; i < topics.auth.secretKeyGeneration.length; i++)
		lines.push(`${i + 1}. ${topics.auth.secretKeyGeneration[i]}`);
	lines.push("");
	lines.push(`Full auth reference: ${topics.auth.docsUrl}`);
	lines.push("");

	// Error model
	lines.push("## Error model");
	lines.push("");
	lines.push(
		"Responses carry `status` (0 = success) and a granular " +
			"`response_status_id`. Common codes (e.g. `463` = user not found, " +
			"`347` = insufficient balance). Full table: " +
			topics.errors.docsUrl +
			".",
	);
	lines.push("");

	// Endpoint index — compact
	lines.push("## API endpoints");
	lines.push("");
	lines.push(
		markdownTable(
			["API", "Method", "Path", "Summary"],
			apis.map((a) => [a.name, a.method, `\`${a.path}\``, a.summary]),
		),
	);
	lines.push("");
	lines.push(
		`Full machine-readable specs: ${SITE_URL}/agent/eps.json ` +
			`(index: ${SITE_URL}/agent/index.json, per-API: ` +
			`${SITE_URL}/agent/api/<slug>.json). OpenAPI: ${SITE_URL}/openapi.json.`,
	);
	lines.push("");

	// Recipes
	lines.push("## Multi-step recipes");
	lines.push("");
	for (const r of recipes) {
		lines.push(`### ${r.name}`);
		lines.push("");
		lines.push(r.summary);
		lines.push("");
		for (let i = 0; i < r.steps.length; i++) {
			const step = r.steps[i];
			const branch = step.branches
				?.map(
					(b) =>
						` (if response_status_id ${b.onResponseStatusId} → ${b.goto})`,
				)
				.join("");
			lines.push(
				`${i + 1}. \`${step.specSlug}\` — ${step.purpose}${branch ?? ""}`,
			);
		}
		lines.push("");
	}

	// MCP pointer
	lines.push("## Live context via MCP");
	lines.push("");
	lines.push(
		`Install the local context server for richer, on-demand lookups:\n\n` +
			"```bash\n" +
			`npx -y ${MCP_PACKAGE}\n` +
			"```",
	);
	lines.push("");

	return lines.join("\n");
};

/** One emitted pack file. */
export interface ContextPackFile {
	/** Path relative to /agent in the build output. */
	file: string;
	build: (bundle: AgentBundle) => string;
}

const withHeading = (heading: string, bundle: AgentBundle): string =>
	`${heading}\n\n${buildContextPackBody(bundle)}`;

export const CONTEXT_PACK_FILES: ContextPackFile[] = [
	{ file: "AGENTS.md", build: (b) => buildContextPackBody(b) },
	{
		file: "CLAUDE.md",
		build: (b) =>
			withHeading("<!-- Eko EPS — drop this in your repo as CLAUDE.md -->", b),
	},
	{
		file: ".cursorrules",
		build: (b) =>
			withHeading("# Eko EPS integration rules (Cursor)", b),
	},
	{
		file: "copilot-instructions.md",
		build: (b) =>
			withHeading(
				"<!-- Place at .github/copilot-instructions.md in your repo -->",
				b,
			),
	},
];
```

- [ ] **Step 2: Commit (implementation; test next)**

```bash
git add src/lib/agent/build-context-pack.ts
git commit -m "feat(agent): add lean context-pack builder + per-target wrappers"
```

---

## Task 7: Context-pack builder tests

**Files:**
- Test: `src/lib/agent/build-context-pack.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/agent/build-context-pack.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { getDocumentedSpecs } from "@/lib/data/docs-registry";
import { buildAgentBundle } from "@/lib/agent/build-agent-bundle";
import {
	CONTEXT_PACK_FILES,
	buildContextPackBody,
} from "@/lib/agent/build-context-pack";

const bundle = buildAgentBundle(getDocumentedSpecs());
const body = buildContextPackBody(bundle);

describe("buildContextPackBody", () => {
	it("inlines the auth + backend-only warning", () => {
		expect(body).toMatch(/backend-only/i);
		expect(body).toContain("secret-key");
		expect(body).toContain("developer_key");
	});

	it("lists every documented endpoint by name", () => {
		for (const api of bundle.apis) expect(body).toContain(api.name);
	});

	it("points at the MCP package and the bundle", () => {
		expect(body).toContain("@ekoindia/eps-context-mcp");
		expect(body).toContain("/agent/eps.json");
	});

	it("includes the exemplar recipes", () => {
		expect(body).toContain("DMT — Send Money");
		expect(body).toContain("AePS — Cash Withdrawal");
	});
});

describe("CONTEXT_PACK_FILES", () => {
	it("emits the four target files, each wrapping the canonical body", () => {
		const files = CONTEXT_PACK_FILES.map((f) => f.file);
		expect(files).toEqual([
			"AGENTS.md",
			"CLAUDE.md",
			".cursorrules",
			"copilot-instructions.md",
		]);
		for (const f of CONTEXT_PACK_FILES) {
			const out = f.build(bundle);
			expect(out).toContain("## Authentication & request signing");
		}
	});
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run src/lib/agent/build-context-pack.test.ts`
Expected: PASS (all).

- [ ] **Step 3: Commit**

```bash
git add src/lib/agent/build-context-pack.test.ts
git commit -m "test(agent): cover context-pack builder + wrappers"
```

---

## Task 8: Emit packs from the plugin

**Files:**
- Modify: `vite-plugin-generate-agent-bundle.ts`

- [ ] **Step 1: Load the pack builder and add pack files**

In `vite-plugin-generate-agent-bundle.ts`, update `buildFiles` to also emit packs. Replace the two `ssrLoadModule` lines and add pack emission:

```ts
	const [registry, builder, packs] = await Promise.all([
		server.ssrLoadModule("/src/lib/data/docs-registry.ts"),
		server.ssrLoadModule("/src/lib/agent/build-agent-bundle.ts"),
		server.ssrLoadModule("/src/lib/agent/build-context-pack.ts"),
	]);
	const specs = registry.getDocumentedSpecs();
	const bundle = builder.buildAgentBundle(specs);

	const files: Record<string, string> = {};
	const j = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`;

	files["agent/eps.json"] = j(bundle);
	files["agent/index.json"] = j(builder.buildIndex(bundle));
	for (const api of bundle.apis)
		files[`agent/api/${api.slug}.json`] = j(builder.buildApi(bundle, api.slug));
	for (const topic of Object.keys(bundle.topics))
		files[`agent/topic/${topic}.json`] = j(builder.buildTopic(bundle, topic));

	for (const pack of packs.CONTEXT_PACK_FILES)
		files[`agent/${pack.file}`] = pack.build(bundle);

	return files;
```

(The middleware already serves `.json`; packs are served only from the built
output. That is acceptable — the dev-time `.md`/pack preview is out of scope.)

- [ ] **Step 2: Build and verify**

Run: `npm run build`
Then: `ls dist/agent` 
Expected: now also `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `copilot-instructions.md`.

- [ ] **Step 3: Commit**

```bash
git add vite-plugin-generate-agent-bundle.ts
git commit -m "feat(agent): emit context packs alongside the bundle"
```

---

## Task 9: Extend llms.txt with an "AI coding agents" section

**Files:**
- Modify: `src/lib/markdown/render-index.ts`

- [ ] **Step 1: Add the section to `renderLlmsTxt`**

In `src/lib/markdown/render-index.ts`, inside `renderLlmsTxt`, after the
existing `## Solutions` block and before the final `return lines.join("\n")`,
insert:

```ts
	lines.push("## For AI coding agents");
	lines.push(
		`- [Context pack (AGENTS.md)](${SITE_URL}/agent/AGENTS.md): Drop-in instructions for any agent — auth, endpoints, recipes`,
	);
	lines.push(
		`- [Machine bundle](${SITE_URL}/agent/eps.json): Canonical JSON of every endpoint, topic, and recipe`,
	);
	lines.push(
		`- [Endpoint index](${SITE_URL}/agent/index.json): Compact list; fetch /agent/api/<slug>.json for detail`,
	);
	lines.push(
		`- [OpenAPI](${SITE_URL}/openapi.json): OpenAPI 3.1 document`,
	);
	lines.push(
		"- Local MCP: `npx -y @ekoindia/eps-context-mcp`",
	);
	lines.push(
		`- [Agents hub](${SITE_URL}/agents): All agent artifacts + install instructions`,
	);
	lines.push("");
```

- [ ] **Step 2: Verify the test suite + a build**

Run: `npx vitest run src/lib/markdown`
Expected: PASS (update any snapshot that asserts `llms.txt` content if present — re-run with `-u` only if the diff is exactly this new section).
Run: `npm run build && grep -A6 "For AI coding agents" dist/llms.txt`
Expected: the new section appears.

- [ ] **Step 3: Commit**

```bash
git add src/lib/markdown/render-index.ts
git commit -m "feat(agent): add AI-coding-agents section to llms.txt"
```

---

## Task 10: `/agents.md` renderer + emission

**Files:**
- Create: `src/lib/markdown/render-agents.ts`
- Modify: `vite-plugin-generate-markdown.ts`

- [ ] **Step 1: Write the renderer**

Create `src/lib/markdown/render-agents.ts`:

```ts
/**
 * Renders `/agents.md` — the markdown twin of the `/agents` hub page. Lists the
 * agent artifacts (packs, bundle, MCP, recipes) generated from the spec layer.
 */
import { SITE_URL } from "@/lib/config/site";
import { RECIPES } from "@/lib/data/api-recipes";
import { markdownTable } from "@/lib/markdown/shared";

export function renderAgentsMarkdown(): string {
	const lines: string[] = [];
	lines.push("# EPS for AI agents");
	lines.push("");
	lines.push(
		"Everything an AI coding agent needs to integrate Eko Platform Services, " +
			"auto-generated from our API source of truth.",
	);
	lines.push("");

	lines.push("## Context packs");
	lines.push(
		markdownTable(
			["Target", "File"],
			[
				["Any agent (AGENTS.md)", `${SITE_URL}/agent/AGENTS.md`],
				["Claude Code (CLAUDE.md)", `${SITE_URL}/agent/CLAUDE.md`],
				["Cursor (.cursorrules)", `${SITE_URL}/agent/.cursorrules`],
				[
					"GitHub Copilot",
					`${SITE_URL}/agent/copilot-instructions.md`,
				],
			],
		),
	);
	lines.push("");

	lines.push("## Local MCP server");
	lines.push("");
	lines.push("```bash");
	lines.push("npx -y @ekoindia/eps-context-mcp");
	lines.push("```");
	lines.push("");

	lines.push("## Machine bundle");
	lines.push(
		`- Canonical: ${SITE_URL}/agent/eps.json\n` +
			`- Index: ${SITE_URL}/agent/index.json\n` +
			`- Per-API: ${SITE_URL}/agent/api/<slug>.json\n` +
			`- OpenAPI: ${SITE_URL}/openapi.json`,
	);
	lines.push("");

	lines.push("## Recipes");
	for (const r of RECIPES) lines.push(`- **${r.name}** — ${r.summary}`);
	lines.push("");

	return lines.join("\n");
}
```

- [ ] **Step 2: Emit it from the markdown plugin**

In `vite-plugin-generate-markdown.ts`:

(a) Add `render-agents.ts` to the `loadRenderBundle` `Promise.all` and destructuring (mirror the existing entries):

```ts
		server.ssrLoadModule("/src/lib/markdown/render-agents.ts"),
```

Add the corresponding binding to the destructured array (e.g. `renderAgentsMod`) and expose it on the returned bundle object (follow how `renderIndexMod` etc. are surfaced — return `renderAgentsMarkdown: renderAgentsMod.renderAgentsMarkdown`).

(b) In `closeBundle()`, alongside the other root-index writes (near the `index.md` / `llms.txt` writes), add:

```ts
	await writeFile(
		path.join(outDir, "agents.md"),
		bundle.renderAgentsMarkdown(),
	);
	written++;
```

(c) If the dev middleware enumerates known `.md` routes, add `/agents.md` there too (match the existing dev-route switch); otherwise skip — the build artifact is what matters.

- [ ] **Step 3: Build and verify**

Run: `npm run build && cat dist/agents.md`
Expected: the agents markdown renders with packs/MCP/bundle/recipes.

- [ ] **Step 4: Commit**

```bash
git add src/lib/markdown/render-agents.ts vite-plugin-generate-markdown.ts
git commit -m "feat(agent): generate /agents.md"
```

---

## Task 11: `/agents` hub page + route wiring

**Files:**
- Create: `src/pages/AgentsPage.tsx`
- Modify: `src/App.tsx`, `ssg/routes.ts`

> Uses `LegalPageLayout` as a known-good content wrapper (Header/Footer/SEO).
> A dedicated marketing layout can replace it later; v1 favors shipping.

- [ ] **Step 1: Write the page**

Create `src/pages/AgentsPage.tsx`:

```tsx
import LegalPageLayout from "@/components/LegalPageLayout";
import { RECIPES } from "@/lib/data/api-recipes";

const PACKS = [
	{ label: "Any agent — AGENTS.md", href: "/agent/AGENTS.md" },
	{ label: "Claude Code — CLAUDE.md", href: "/agent/CLAUDE.md" },
	{ label: "Cursor — .cursorrules", href: "/agent/.cursorrules" },
	{ label: "GitHub Copilot", href: "/agent/copilot-instructions.md" },
];

const BUNDLE_LINKS = [
	{ label: "Canonical bundle (eps.json)", href: "/agent/eps.json" },
	{ label: "Endpoint index (index.json)", href: "/agent/index.json" },
	{ label: "OpenAPI 3.1 (openapi.json)", href: "/openapi.json" },
];

const AgentsPage = () => {
	return (
		<LegalPageLayout
			title="EPS for AI agents"
			description="Drop-in context packs, a local MCP server, and a machine-readable API bundle — everything an AI coding agent needs to integrate Eko Platform Services."
		>
			<h2>Context packs</h2>
			<p>Drop one of these into your repo so your agent gets EPS auth, endpoints, and recipes right:</p>
			<ul>
				{PACKS.map((p) => (
					<li key={p.href}>
						<a href={p.href}>{p.label}</a>
					</li>
				))}
			</ul>

			<h2>Local MCP server</h2>
			<p>Install the local context server (zero hosting, zero secrets):</p>
			<pre>
				<code>npx -y @ekoindia/eps-context-mcp</code>
			</pre>

			<h2>Machine bundle</h2>
			<ul>
				{BUNDLE_LINKS.map((b) => (
					<li key={b.href}>
						<a href={b.href}>{b.label}</a>
					</li>
				))}
			</ul>

			<h2>Recipes</h2>
			<ul>
				{RECIPES.map((r) => (
					<li key={r.id}>
						<strong>{r.name}</strong> — {r.summary}
					</li>
				))}
			</ul>
		</LegalPageLayout>
	);
};

export default AgentsPage;
```

- [ ] **Step 2: Add the React route**

In `src/App.tsx`, add the lazy import (with the other `lazy(() => import(...))` lines):

```ts
const AgentsPage = lazy(() => import("./pages/AgentsPage"));
```

And add the route (near `/pricing`):

```tsx
			<Route path="/agents" element={<AgentsPage />} />
```

- [ ] **Step 3: Register for SSG**

In `ssg/routes.ts`:

(a) Add to `ROUTE_CHUNK_MAP`:

```ts
	{ pattern: /^\/agents$/, src: "src/pages/AgentsPage.tsx" },
```

(b) Add to `PRERENDER_ROUTES` (near `"/pricing"`):

```ts
	"/agents",
```

- [ ] **Step 4: Build and verify the route prerenders**

Run: `npm run build && ls dist/agents/index.html dist/agents.md`
Expected: both exist. (SSG emits `dist/agents/index.html`; Task 10 emitted `dist/agents.md`.)

- [ ] **Step 5: Commit**

```bash
git add src/pages/AgentsPage.tsx src/App.tsx ssg/routes.ts
git commit -m "feat(agent): add /agents hub page + routing"
```

---

## Task 12: Nav + command-palette entries

**Files:**
- Modify: `src/lib/search-index.ts`, `src/components/Header.tsx`

- [ ] **Step 1: Add the command-palette item**

In `src/lib/search-index.ts`, inside `buildPageItems()`, add an entry (reuse an existing imported `lucide-react` icon, e.g. `Bot` — add it to the existing `lucide-react` import if not present):

```ts
	{
		id: "page:agents",
		label: "EPS for AI agents",
		sublabel: "Context packs, MCP server, machine bundle",
		href: "/agents",
		category: "page",
		keywords: ["ai", "agent", "mcp", "llm", "claude", "cursor", "copilot", "openapi"],
		icon: Bot,
		suggested: true,
	},
```

- [ ] **Step 2: Add a header nav link**

In `src/components/Header.tsx`, add to the `navLinks` array (after `Pricing`):

```ts
	{ label: "AI Agents", href: "/agents" },
```

- [ ] **Step 3: Verify**

Run: `npm run build`
Then open the built site / run `npm run preview` and confirm: `/agents` is in the header, the command palette finds "EPS for AI agents".
Run: `npx vitest run` (full suite) and `npm run lint`.
Expected: tests pass; lint clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/search-index.ts src/components/Header.tsx
git commit -m "feat(agent): surface /agents in nav + command palette"
```

---

## Final verification

- [ ] Run `npx vitest run` — all pass.
- [ ] Run `npm run lint` — clean.
- [ ] Run `npm run build` and confirm in `dist/`: `agent/eps.json`, `agent/index.json`, `agent/api/*.json`, `agent/topic/{auth,errors,pricing,environments}.json`, `agent/{AGENTS.md,CLAUDE.md,.cursorrules,copilot-instructions.md}`, `agents.md`, `agents/index.html`, and the new `llms.txt` section.
- [ ] Spot-check `dist/agent/AGENTS.md`: backend-only warning present, endpoint table present, recipes present, MCP install line present.

---

## Self-Review notes (spec coverage)

- Recipes (schema + 2 exemplars): Task 1. ✅
- Bundle builder + slices + content-hash + recipe-slug guard: Tasks 2–4. ✅
- Single + split emission: Task 5. ✅
- Lean packs + 4 wrappers + backend-only inline: Tasks 6–8. ✅
- llms.txt section: Task 9. ✅
- `/agents` hub + `/agents.md` + nav + palette: Tasks 10–12. ✅
- Determinism/no-Date: fnv1a hash (Task 3); byte-stable test (Task 4). ✅
- Security (no access_key value leak): Task 4 guard; backend-only warning in bundle + packs. ✅
```
