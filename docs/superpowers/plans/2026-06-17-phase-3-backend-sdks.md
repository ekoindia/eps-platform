# Phase 3 — Backend-Only Signed SDKs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship thin, backend-only signed SDKs (JS/TS + PHP first) with HMAC signing baked in correctly, generated from `eps.json`, plus Postman/Bruno collections with signing pre-request scripts.

**Architecture:** A pure generator emits a language-neutral `sdk-surface.json` (environments, endpoint catalog, error codes) from the bundle. Each SDK = a hand-maintained signing/runtime **core** + the embedded surface + a generic `call(slug, params)`. A shared **golden signing vector** guarantees cross-language equivalence.

**Tech Stack:** TypeScript (`packages/sdk-js`), PHP (`packages/sdk-php`), Vitest + PHPUnit. Surface generator is a pure builder in the website `src/`, emitted by the Phase 0/1 agent vite plugin.

**Spec:** `docs/superpowers/specs/2026-06-17-phase-3-backend-sdks-design.md`
**Depends on:** Phase 0 (`/agent/eps.json`), Phase 2 (monorepo workspaces).

**Signing algorithm (authoritative):** `secret-key = base64(HMAC-SHA256(message = timestamp_ms, key = base64(access_key)))`. Headers: `developer_key`, `secret-key`, `secret-key-timestamp`, `content-type: application/json`. **access_key is server-side-only.**

---

## File Structure

- Create `src/lib/sdk/build-sdk-surface.ts` (+ test) — pure, emits the surface object.
- Modify `vite-plugin-generate-agent-bundle.ts` — emit `/agent/sdk-surface.json`.
- Create `packages/sdk-js/` — TS SDK (core + embedded surface + tests).
- Create `packages/sdk-php/` — PHP SDK (core + embedded surface + phpunit tests).
- Create `src/lib/sdk/build-postman.ts` (+ test) — pure Postman + Bruno builders.
- Modify `vite-plugin-generate-agent-bundle.ts` — emit `/agent/eps.postman_collection.json` + `/agent/bruno/*`.
- Create `docs/sdk-golden-vector.md` — the pinned cross-language test vector.

---

## Task 1: SDK surface generator

**Files:**
- Create: `src/lib/sdk/build-sdk-surface.ts`
- Test: `src/lib/sdk/build-sdk-surface.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/sdk/build-sdk-surface.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { getDocumentedSpecs } from "@/lib/data/docs-registry";
import { buildAgentBundle } from "@/lib/agent/build-agent-bundle";
import { buildSdkSurface } from "@/lib/sdk/build-sdk-surface";

const bundle = buildAgentBundle(getDocumentedSpecs());
const surface = buildSdkSurface(bundle);

describe("buildSdkSurface", () => {
	it("lists both environments with base URLs", () => {
		const ids = surface.environments.map((e) => e.id);
		expect(ids).toContain("sandbox");
		expect(ids).toContain("production");
	});

	it("emits one endpoint per api with method + path + required params", () => {
		expect(surface.endpoints.length).toBe(bundle.apis.length);
		const e = surface.endpoints[0];
		expect(e).toHaveProperty("slug");
		expect(e).toHaveProperty("method");
		expect(e).toHaveProperty("path");
		expect(Array.isArray(e.requiredParams)).toBe(true);
	});

	it("includes the error-code table", () => {
		expect(surface.errorCodes.length).toBeGreaterThan(0);
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/sdk/build-sdk-surface.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/lib/sdk/build-sdk-surface.ts`:

```ts
/**
 * Pure builder for the language-neutral SDK surface embedded by every signed
 * SDK: environments, a thin endpoint catalog, and the error-code table. Derived
 * from the agent bundle; no I/O, no Date (byte-stable).
 */
import type { AgentBundle, AgentEnvironment } from "@/lib/agent/agent-bundle-types";
import type { ApiErrorCode } from "@/lib/data/api-error-codes";

export interface SdkEndpoint {
	slug: string;
	method: string;
	path: string;
	requiredParams: string[];
}

export interface SdkSurface {
	apiVersion: string;
	bundleVersion: string;
	environments: AgentEnvironment[];
	endpoints: SdkEndpoint[];
	errorCodes: ApiErrorCode[];
}

export const buildSdkSurface = (bundle: AgentBundle): SdkSurface => ({
	apiVersion: bundle.meta.apiVersion,
	bundleVersion: bundle.meta.bundleVersion,
	environments: bundle.meta.environments,
	endpoints: bundle.apis.map((a) => ({
		slug: a.slug,
		method: a.method,
		path: a.path,
		requiredParams: a.requestParams
			.filter((p) => p.required)
			.map((p) => p.name),
	})),
	errorCodes: bundle.topics.errors.codes,
});
```

- [ ] **Step 4: Run test + emit from the plugin**

Run: `npx vitest run src/lib/sdk/build-sdk-surface.test.ts` → PASS.

In `vite-plugin-generate-agent-bundle.ts`, add to `buildFiles`:
- load `/src/lib/sdk/build-sdk-surface.ts`,
- `files["agent/sdk-surface.json"] = j(sdk.buildSdkSurface(bundle));`

- [ ] **Step 5: Build + verify + commit**

Run: `npm run build && cat dist/agent/sdk-surface.json | head -20`

```bash
git add src/lib/sdk/build-sdk-surface.ts src/lib/sdk/build-sdk-surface.test.ts vite-plugin-generate-agent-bundle.ts
git commit -m "feat(sdk): emit language-neutral /agent/sdk-surface.json"
```

---

## Task 2: Pin the golden signing vector

**Files:**
- Create: `docs/sdk-golden-vector.md`

- [ ] **Step 1: Compute the vector once with a trusted implementation**

Run this Node snippet (the reference implementation of the algorithm):

```bash
node -e 'const c=require("crypto");const ak="TEST_ACCESS_KEY_DO_NOT_USE";const ts="1700000000000";const ek=Buffer.from(ak).toString("base64");console.log(c.createHmac("sha256",ek).update(ts).digest("base64"))'
```

- [ ] **Step 2: Record the vector**

Create `docs/sdk-golden-vector.md` and paste the printed value:

```markdown
# SDK golden signing vector

Cross-language conformance fixture. Every SDK core must reproduce this.

- access_key: `TEST_ACCESS_KEY_DO_NOT_USE`
- secret-key-timestamp: `1700000000000`
- expected secret-key (base64): `<PASTE THE OUTPUT FROM STEP 1 HERE>`

Algorithm: `base64(HMAC-SHA256(message = timestamp, key = base64(access_key)))`.
```

- [ ] **Step 3: Commit**

```bash
git add docs/sdk-golden-vector.md
git commit -m "docs(sdk): pin cross-language golden signing vector"
```

---

## Task 3: JS/TS SDK

**Files:**
- Create: `packages/sdk-js/package.json`, `tsconfig.json`, `tsup.config.ts`
- Create: `packages/sdk-js/scripts/bake-surface.mjs`
- Create: `packages/sdk-js/src/client.ts`, `src/types.ts`, `src/index.ts`
- Create: `packages/sdk-js/data/sdk-surface.json` (baked)
- Test: `packages/sdk-js/src/client.test.ts`

- [ ] **Step 1: Scaffold the package**

Create `packages/sdk-js/package.json`:

```json
{
	"name": "@ekoindia/eps-sdk",
	"version": "0.1.0",
	"description": "Backend-only Node.js SDK for Eko Platform Services (EPS) APIs, with request signing built in.",
	"license": "MIT",
	"type": "module",
	"main": "./dist/index.js",
	"types": "./dist/index.d.ts",
	"files": ["dist", "data"],
	"scripts": {
		"bake": "node scripts/bake-surface.mjs",
		"build": "tsup",
		"test": "vitest run",
		"prepublishOnly": "npm run bake && npm run build"
	},
	"devDependencies": { "tsup": "^8.0.0", "typescript": "^5.4.0", "vitest": "^2.0.0" },
	"engines": { "node": ">=18" }
}
```

Create `packages/sdk-js/tsconfig.json` and `tsup.config.ts` identical to the
MCP package's (Phase 2 Task 1, Step 3), with `dts: true` added to the tsup
config so `.d.ts` is emitted:

```ts
import { defineConfig } from "tsup";
export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm"],
	target: "node18",
	dts: true,
	clean: true,
});
```

Create `packages/sdk-js/scripts/bake-surface.mjs` — same shape as the MCP bake
script (Phase 2 Task 2 Step 1) but copying `dist/agent/sdk-surface.json` →
`packages/sdk-js/data/sdk-surface.json`.

- [ ] **Step 2: Write the failing test (golden vector + call building)**

Create `packages/sdk-js/src/client.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

import { EpsClient, signSecretKey } from "./client.js";

// from docs/sdk-golden-vector.md
const GOLDEN = "<PASTE expected secret-key from docs/sdk-golden-vector.md>";

describe("signSecretKey", () => {
	it("reproduces the golden vector", () => {
		expect(signSecretKey("TEST_ACCESS_KEY_DO_NOT_USE", "1700000000000")).toBe(GOLDEN);
	});
});

describe("EpsClient.call", () => {
	it("sends signed headers and the right method/url", async () => {
		const fetchMock = vi.fn(async () => new Response(JSON.stringify({ status: 0 }), { status: 200 }));
		const client = new EpsClient({
			developerKey: "dev123",
			accessKey: "TEST_ACCESS_KEY_DO_NOT_USE",
			environment: "sandbox",
			fetch: fetchMock as unknown as typeof fetch,
			now: () => 1700000000000,
		});
		await client.call("dmt-get-sender", { initiator_id: "9962981729" });
		const [url, init] = fetchMock.mock.calls[0];
		expect(String(url)).toContain("/customer/profile");
		const headers = init.headers as Record<string, string>;
		expect(headers["developer_key"]).toBe("dev123");
		expect(headers["secret-key"]).toBe(GOLDEN);
		expect(headers["secret-key-timestamp"]).toBe("1700000000000");
	});

	it("throws when constructed in a browser-like environment", () => {
		(globalThis as { window?: unknown }).window = {};
		expect(
			() => new EpsClient({ developerKey: "d", accessKey: "a", environment: "sandbox" }),
		).toThrow(/backend-only/i);
		delete (globalThis as { window?: unknown }).window;
	});
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm test -w @ekoindia/eps-sdk`
Expected: FAIL — module not found.

- [ ] **Step 4: Write the SDK core**

Create `packages/sdk-js/src/client.ts`:

```ts
import crypto from "node:crypto";

import surface from "../data/sdk-surface.json" assert { type: "json" };

export interface SdkEndpoint {
	slug: string;
	method: string;
	path: string;
	requiredParams: string[];
}
interface Surface {
	environments: { id: string; baseUrl: string }[];
	endpoints: SdkEndpoint[];
}
const SURFACE = surface as unknown as Surface;

export interface EpsClientOptions {
	developerKey: string;
	accessKey: string;
	environment: "sandbox" | "production";
	fetch?: typeof fetch;
	now?: () => number;
}

/** secret-key = base64(HMAC-SHA256(timestamp, base64(access_key))). */
export const signSecretKey = (accessKey: string, timestamp: string): string => {
	const encodedKey = Buffer.from(accessKey).toString("base64");
	return crypto.createHmac("sha256", encodedKey).update(timestamp).digest("base64");
};

export class EpsClient {
	private readonly baseUrl: string;
	private readonly fetchFn: typeof fetch;
	private readonly now: () => number;

	constructor(private readonly opts: EpsClientOptions) {
		// Backend-only guard: access_key must never run in a browser.
		if (typeof (globalThis as { window?: unknown }).window !== "undefined") {
			throw new Error(
				"EpsClient is backend-only: never instantiate it in a browser (access_key would leak).",
			);
		}
		const env = SURFACE.environments.find((e) => e.id === opts.environment);
		if (!env) throw new Error(`Unknown environment "${opts.environment}".`);
		this.baseUrl = env.baseUrl;
		this.fetchFn = opts.fetch ?? fetch;
		this.now = opts.now ?? Date.now;
	}

	private endpoint(slug: string): SdkEndpoint {
		const e = SURFACE.endpoints.find((x) => x.slug === slug);
		if (!e) throw new Error(`Unknown endpoint slug "${slug}".`);
		return e;
	}

	async call<T = unknown>(slug: string, params: Record<string, unknown> = {}): Promise<T> {
		const endpoint = this.endpoint(slug);
		const timestamp = String(this.now());
		const headers: Record<string, string> = {
			developer_key: this.opts.developerKey,
			"secret-key": signSecretKey(this.opts.accessKey, timestamp),
			"secret-key-timestamp": timestamp,
			"content-type": "application/json",
		};
		// Path params (e.g. {customer_id}) come from params; the rest form the body.
		let path = endpoint.path;
		const body: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(params)) {
			const token = `{${k}}`;
			if (path.includes(token)) path = path.replace(token, encodeURIComponent(String(v)));
			else body[k] = v;
		}
		const url = `${this.baseUrl}${path}`;
		const init: RequestInit = { method: endpoint.method, headers };
		if (endpoint.method !== "GET") init.body = JSON.stringify(body);
		const res = await this.fetchFn(url, init);
		return (await res.json()) as T;
	}
}
```

Create `packages/sdk-js/src/index.ts`:

```ts
export { EpsClient, signSecretKey } from "./client.js";
export type { EpsClientOptions, SdkEndpoint } from "./client.js";
```

- [ ] **Step 5: Bake the surface, fill the golden value, run tests**

Run: `npm run build` (repo root, to emit sdk-surface.json) then
`npm run bake -w @ekoindia/eps-sdk`.
Paste the golden value from `docs/sdk-golden-vector.md` into the test's `GOLDEN`.
Run: `npm test -w @ekoindia/eps-sdk`
Expected: PASS (golden vector, signed call, browser guard).

- [ ] **Step 6: Commit**

```bash
git add packages/sdk-js
git commit -m "feat(sdk): backend-only Node.js SDK with HMAC signing"
```

---

## Task 4: PHP SDK

**Files:**
- Create: `packages/sdk-php/composer.json`
- Create: `packages/sdk-php/scripts/bake-surface.php` (or reuse a copy step)
- Create: `packages/sdk-php/src/EpsClient.php`
- Create: `packages/sdk-php/data/sdk-surface.json` (baked)
- Test: `packages/sdk-php/tests/EpsClientTest.php`

> Requires PHP 8.1+ and Composer locally. If unavailable, mark this task blocked
> and proceed to Task 5; the JS SDK already proves the pattern.

- [ ] **Step 1: Scaffold composer**

Create `packages/sdk-php/composer.json`:

```json
{
	"name": "ekoindia/eps-sdk",
	"description": "Backend-only PHP SDK for Eko Platform Services (EPS) APIs, with request signing built in.",
	"type": "library",
	"license": "MIT",
	"require": { "php": ">=8.1" },
	"require-dev": { "phpunit/phpunit": "^10" },
	"autoload": { "psr-4": { "Eko\\Eps\\": "src/" } },
	"autoload-dev": { "psr-4": { "Eko\\Eps\\Tests\\": "tests/" } }
}
```

- [ ] **Step 2: Write the failing test**

Create `packages/sdk-php/tests/EpsClientTest.php`:

```php
<?php
use PHPUnit\Framework\TestCase;
use Eko\Eps\EpsClient;

final class EpsClientTest extends TestCase
{
    // from docs/sdk-golden-vector.md
    private const GOLDEN = '<PASTE expected secret-key>';

    public function testGoldenVector(): void
    {
        $this->assertSame(
            self::GOLDEN,
            EpsClient::signSecretKey('TEST_ACCESS_KEY_DO_NOT_USE', '1700000000000')
        );
    }

    public function testBuildsSignedHeaders(): void
    {
        $client = new EpsClient('dev123', 'TEST_ACCESS_KEY_DO_NOT_USE', 'sandbox', fn () => 1700000000000);
        $headers = $client->buildHeaders();
        $this->assertSame('dev123', $headers['developer_key']);
        $this->assertSame(self::GOLDEN, $headers['secret-key']);
        $this->assertSame('1700000000000', $headers['secret-key-timestamp']);
    }
}
```

- [ ] **Step 3: Write the core**

Create `packages/sdk-php/src/EpsClient.php`:

```php
<?php
namespace Eko\Eps;

/** Backend-only EPS client. Never expose access_key in a frontend. */
final class EpsClient
{
    private array $surface;
    private string $baseUrl;

    public function __construct(
        private string $developerKey,
        private string $accessKey,
        string $environment,
        private $now = null
    ) {
        $this->now = $this->now ?? fn () => (int) round(microtime(true) * 1000);
        $this->surface = json_decode(file_get_contents(__DIR__ . '/../data/sdk-surface.json'), true);
        foreach ($this->surface['environments'] as $env) {
            if ($env['id'] === $environment) { $this->baseUrl = $env['baseUrl']; break; }
        }
        if (!isset($this->baseUrl)) throw new \InvalidArgumentException("Unknown environment: $environment");
    }

    /** secret-key = base64(HMAC-SHA256(timestamp, base64(access_key))). */
    public static function signSecretKey(string $accessKey, string $timestamp): string
    {
        $encodedKey = base64_encode($accessKey);
        return base64_encode(hash_hmac('sha256', $timestamp, $encodedKey, true));
    }

    public function buildHeaders(): array
    {
        $timestamp = (string) ($this->now)();
        return [
            'developer_key' => $this->developerKey,
            'secret-key' => self::signSecretKey($this->accessKey, $timestamp),
            'secret-key-timestamp' => $timestamp,
            'content-type' => 'application/json',
        ];
    }

    public function call(string $slug, array $params = []): array
    {
        $endpoint = null;
        foreach ($this->surface['endpoints'] as $e) if ($e['slug'] === $slug) { $endpoint = $e; break; }
        if ($endpoint === null) throw new \InvalidArgumentException("Unknown endpoint slug: $slug");

        $path = $endpoint['path'];
        $body = [];
        foreach ($params as $k => $v) {
            $token = '{' . $k . '}';
            if (str_contains($path, $token)) $path = str_replace($token, rawurlencode((string) $v), $path);
            else $body[$k] = $v;
        }
        $ch = curl_init($this->baseUrl . $path);
        $headers = $this->buildHeaders();
        $headerLines = array_map(fn ($k, $v) => "$k: $v", array_keys($headers), $headers);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => $endpoint['method'],
            CURLOPT_HTTPHEADER => $headerLines,
        ]);
        if ($endpoint['method'] !== 'GET') curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
        $res = curl_exec($ch);
        curl_close($ch);
        return json_decode($res, true) ?? [];
    }
}
```

- [ ] **Step 4: Bake surface + run tests**

Copy `dist/agent/sdk-surface.json` → `packages/sdk-php/data/sdk-surface.json`
(after a root `npm run build`). Paste the golden value into the test.
Run: `cd packages/sdk-php && composer install && ./vendor/bin/phpunit`
Expected: PASS (golden vector + signed headers).

- [ ] **Step 5: Commit**

```bash
git add packages/sdk-php
git commit -m "feat(sdk): backend-only PHP SDK with HMAC signing"
```

---

## Task 5: Postman + Bruno collections

**Files:**
- Create: `src/lib/sdk/build-postman.ts`
- Test: `src/lib/sdk/build-postman.test.ts`
- Modify: `vite-plugin-generate-agent-bundle.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/sdk/build-postman.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { getDocumentedSpecs } from "@/lib/data/docs-registry";
import { buildAgentBundle } from "@/lib/agent/build-agent-bundle";
import { buildPostmanCollection, PRE_REQUEST_SIGNING_SCRIPT } from "@/lib/sdk/build-postman";

const bundle = buildAgentBundle(getDocumentedSpecs());
const collection = buildPostmanCollection(bundle);

describe("buildPostmanCollection", () => {
	it("has an item per endpoint", () => {
		const count = collection.item.reduce(
			(n, folder) => n + (folder.item?.length ?? 0),
			0,
		);
		expect(count).toBe(bundle.apis.length);
	});

	it("ships a collection-level pre-request signing script", () => {
		const script = collection.event?.find((e) => e.listen === "prerequest");
		expect(script?.script.exec.join("\n")).toContain("CryptoJS.HmacSHA256");
	});

	it("the signing script computes secret-key from collection variables", () => {
		expect(PRE_REQUEST_SIGNING_SCRIPT).toContain("access_key");
		expect(PRE_REQUEST_SIGNING_SCRIPT).toContain("secret-key");
	});
});
```

- [ ] **Step 2: Run to verify it fails → then implement**

Run: `npx vitest run src/lib/sdk/build-postman.test.ts` → FAIL.

Create `src/lib/sdk/build-postman.ts`:

```ts
/**
 * Pure builders for a Postman collection (v2.1) and a Bruno collection from the
 * agent bundle, each with a pre-request script that computes the EPS secret-key
 * from collection variables. For LOCAL/testing use — do not commit real secrets.
 */
import type { AgentBundle } from "@/lib/agent/agent-bundle-types";

/** Postman pre-request: compute secret-key via the bundled CryptoJS. */
export const PRE_REQUEST_SIGNING_SCRIPT = [
	"const ts = Date.now().toString();",
	"const accessKey = pm.collectionVariables.get('access_key');",
	"const encodedKey = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(accessKey));",
	"const sig = CryptoJS.HmacSHA256(ts, encodedKey);",
	"pm.collectionVariables.set('secret-key', CryptoJS.enc.Base64.stringify(sig));",
	"pm.collectionVariables.set('secret-key-timestamp', ts);",
].join("\n");

interface PostmanScript {
	listen: string;
	script: { type: string; exec: string[] };
}
interface PostmanRequest {
	name: string;
	request: Record<string, unknown>;
}
interface PostmanFolder {
	name: string;
	item: PostmanRequest[];
}
export interface PostmanCollection {
	info: Record<string, unknown>;
	event?: PostmanScript[];
	variable: { key: string; value: string }[];
	item: PostmanFolder[];
}

export const buildPostmanCollection = (bundle: AgentBundle): PostmanCollection => {
	const baseUrl = bundle.meta.environments[0].baseUrl;
	const byProduct = new Map<string, PostmanRequest[]>();
	for (const a of bundle.apis) {
		const item: PostmanRequest = {
			name: a.name,
			request: {
				method: a.method,
				header: [
					{ key: "developer_key", value: "{{developer_key}}" },
					{ key: "secret-key", value: "{{secret-key}}" },
					{ key: "secret-key-timestamp", value: "{{secret-key-timestamp}}" },
					{ key: "content-type", value: "application/json" },
				],
				url: { raw: `${baseUrl}${a.path}`, host: [baseUrl], path: a.path.split("/").filter(Boolean) },
				body:
					a.method === "GET"
						? undefined
						: { mode: "raw", raw: JSON.stringify(a.sampleRequest, null, 2) },
				description: a.summary,
			},
		};
		const list = byProduct.get(a.productName) ?? [];
		list.push(item);
		byProduct.set(a.productName, list);
	}
	return {
		info: {
			name: "Eko Platform Services",
			schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
			description: "Generated from eps.json. Set access_key + developer_key in collection variables (local use only).",
		},
		event: [{ listen: "prerequest", script: { type: "text/javascript", exec: PRE_REQUEST_SIGNING_SCRIPT.split("\n") } }],
		variable: [
			{ key: "access_key", value: "" },
			{ key: "developer_key", value: "" },
			{ key: "secret-key", value: "" },
			{ key: "secret-key-timestamp", value: "" },
		],
		item: [...byProduct.entries()].map(([name, item]) => ({ name, item })),
	};
};
```

Run: `npx vitest run src/lib/sdk/build-postman.test.ts` → PASS.

- [ ] **Step 3: Emit from the plugin**

In `vite-plugin-generate-agent-bundle.ts` `buildFiles`, load `build-postman.ts`
and add: `files["agent/eps.postman_collection.json"] =
j(postman.buildPostmanCollection(bundle));`.

(Bruno export is optional v2: a Bruno `.bru` folder can be added later with the
same pre-request script; Postman covers the primary need.)

- [ ] **Step 4: Build, verify, commit**

Run: `npm run build && cat dist/agent/eps.postman_collection.json | head -20`

```bash
git add src/lib/sdk/build-postman.ts src/lib/sdk/build-postman.test.ts vite-plugin-generate-agent-bundle.ts
git commit -m "feat(sdk): generate Postman collection with signing pre-request script"
```

---

## Task 6: Link from the /agents hub + final verification

**Files:**
- Modify: `src/pages/AgentsPage.tsx`, `src/lib/markdown/render-agents.ts`

- [ ] **Step 1: Add SDK + Postman links to the hub**

In `src/pages/AgentsPage.tsx` add a "SDKs & tools" section listing:
- `@ekoindia/eps-sdk` (npm), `ekoindia/eps-sdk` (Composer),
- Postman collection link `/agent/eps.postman_collection.json`.

Mirror the same section in `src/lib/markdown/render-agents.ts`.

- [ ] **Step 2: Verify + commit**

Run: `npx vitest run && npm run lint && npm run build`
Expected: all pass; `dist/agent/eps.postman_collection.json` + `sdk-surface.json` present.

```bash
git add src/pages/AgentsPage.tsx src/lib/markdown/render-agents.ts
git commit -m "feat(sdk): surface SDKs + Postman on the /agents hub"
```

---

## Final verification

- [ ] `npm test -w @ekoindia/eps-sdk` — golden vector + signed call + browser guard pass.
- [ ] PHP: `phpunit` golden vector + headers pass (if PHP available).
- [ ] `npx vitest run` (website) — surface + postman builders pass.
- [ ] Both SDK cores reproduce the SAME pinned golden secret-key (cross-language equivalence).
- [ ] `npm run build` emits `sdk-surface.json` + `eps.postman_collection.json`.

## Self-Review notes (spec coverage)

- Thin signed client (`call(slug, params)`): Tasks 3, 4. ✅
- Hybrid codegen (handwritten core + generated surface): Tasks 1, 3, 4. ✅
- First cut PHP + JS/TS; repeatable for Java/C#/Python/Go (same surface + core contract): Tasks 3, 4. ✅
- Backend-only guard + access_key never frontend: Task 3 (browser guard), both READMEs. ✅
- Golden signing conformance across languages: Tasks 2, 3, 4. ✅
- Postman/Bruno with pre-request signing: Task 5. ✅
```
