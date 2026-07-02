# EPS Backend Phase 4 — Docs-Chat Agent (design)

**Date:** 2026-07-02
**Status:** Design — approved for spec; implementation parked (do not build yet)
**Package:** `packages/eps-backend` (+ thin frontend touch in web app)
**Depends on:** AI-native agent platform (merged, PR #43) — canonical `/agent/eps.json`; developer OTP auth foundation (merged)

---

## 1. Goal

Let a **logged-in EPS developer** ask natural-language questions about EPS API integration and get correct, grounded answers — especially for the non-obvious HMAC signing (`secret-key = base64(HMAC-SHA256(timestamp, base64(access_key)))`) that generic tooling gets wrong. This is the "live ask-the-docs agent" the AI-native roadmap deferred under "only when really required" — now scoped minimally.

**Why now:** Phase 3 production hardening is complete; the backend is a hardened control plane with reusable rate-limit / audit / store seams. A gated docs-chat is the smallest agentic surface that adds real developer value without opening the backend to the public internet.

### Non-goals

- **Anonymous / public chat.** Requires exposing the VPN-only VM to the internet + bot defense + paying LLM cost per stranger. Explicitly out of scope; login-gated only.
- **Transactional actions.** Chat never signs or sends a real API call. Read-only Q&A. (Transactional MCP `@ekoindia/eps-mcp` is a separate, credential-blocked product — see `eps-transact-mcp` branch.)
- **Chat persistence / history.** No server-side storage of conversations. In-memory client session only.
- **Streaming (SSE).** v1 is buffered. Deferred to v2 if latency complaints appear.
- **Agentic multi-tool loop.** Single retrieve-then-answer call. No server-side agent iteration.
- **Typed per-endpoint reasoning / codegen.** Answers are prose + code snippets from grounding, not generated SDKs.

---

## 2. Scope decisions (locked in brainstorm 2026-07-02)

| Axis                | Decision                                                                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Audience            | **Logged-in developers only** (existing OTP session). No public exposure.                                                                           |
| Entry point         | **Command bar "Ask AI" row** → popup dialog. Reuses `CommandPalette.tsx` (cmdk).                                                                    |
| Answer architecture | **Retrieve-then-answer** — local search over bundle → stuff top slices into one LLM call.                                                           |
| Providers           | **Multi-provider**: Anthropic, OpenAI, OpenRouter — selected by env. Project-specific env names (NOT generic `ANTHROPIC_API_KEY`/`OPENAI_API_KEY`). |
| Response            | **Buffered JSON** (no SSE) in v1.                                                                                                                   |
| Storage             | **None.** No chat logged, no chat stored.                                                                                                           |

---

## 3. UX flow

1. In the existing command palette (`src/components/CommandPalette.tsx`), when the query is non-empty **and** the user is logged in, append a row: **"Ask AI: _{query}_"** below the normal search results.
   - Not logged in → row absent (zero noise). Feature disabled server-side → row absent (config flag, mirrors `VITE_SHOW_USER_LOGIN` exposure pattern).
2. Selecting the row opens a **popup Dialog** (shadcn `Dialog`, same primitive as the admin deploy dialog) seeded with the query as the first user message.
3. The dialog shows the answer (rendered markdown), cited source slugs, and an input for follow-ups. Multi-turn within the open popup.
4. Conversation history is **client-held, in-memory only**. Closing the popup discards it. A sliding window of the last **10 turns** is sent per request.
5. Microcopy in the input: "Don't paste secrets — messages are sent to an AI provider." (users may paste API keys; we warn, we don't log — see §7.)

**Page context seed:** if the palette is opened from a docs API page, the current `apiSlug` is passed as retrieval context to boost relevance. Optional; absent elsewhere.

---

## 4. API contract

New route module `packages/eps-backend/src/http/chat.ts`, mounted in `app.ts` alongside admin routes.

### `POST /chat/ask`

- **Auth:** existing developer-session middleware (same guard as `/me`). Missing/invalid session → `401`.
- **Request body:**
  ```json
  {
    "messages": [{ "role": "user" | "assistant", "content": "string" }],
    "context": { "apiSlug": "string (optional)" }
  }
  ```
- **Input limits (abuse posture):** max **10** messages; max **4000** chars per message; max **32 KB** total body. Violations → `400 BAD_REQUEST`.
- **Success `200`:**
  ```json
  {
  	"answer": "markdown string",
  	"sources": ["api-slug", "topic:auth"],
  	"usage": { "inputTokens": 0, "outputTokens": 0 }
  }
  ```
- **Correlation + access log:** `rid` and access-log line come free from existing middleware (`requestId.ts`, `accessLog.ts`). **Message bodies are never logged** (access log already excludes bodies).

### Error codes

| Condition                                | Status | Code                     |
| ---------------------------------------- | ------ | ------------------------ |
| No/invalid session                       | 401    | (existing auth error)    |
| Body too large / malformed               | 400    | `BAD_REQUEST`            |
| Per-login rate limit hit                 | 429    | `RATE_LIMITED`           |
| Rate-limit KV outage                     | 503    | `RATE_LIMIT_UNAVAILABLE` |
| Monthly spend budget exhausted           | 503    | `CHAT_BUDGET_EXHAUSTED`  |
| Feature not configured (no provider/key) | 503    | `CHAT_DISABLED`          |
| Provider timeout / 4xx / 5xx             | 502    | `UPSTREAM_ERROR`         |

All via the existing `AppError` model + `app.onError` mapping.

- `RATE_LIMITED` is the exact code `enforceRateLimit` already throws (`rateLimit.ts:44`) — reused unchanged.
- `UPSTREAM_ERROR` (502) is the existing code used for GitHub-upstream failures (`admin/docsService.ts:109,136`); the chat route reuses it for provider failures. (Note: `UPSTREAM_UNAVAILABLE` is a **different** existing code, reserved for repo-write-unknown at `admin.ts:61` — not reused here.)
- `CHAT_DISABLED` and `CHAT_BUDGET_EXHAUSTED` are **new** codes added to the error model.

---

## 5. Grounding — retrieve-then-answer

### Bundle accessor reuse — REQUIRES extraction to a shared package

⚠️ **Codex-verified correction (2026-07-02):** the accessors CANNOT be imported from `@ekoindia/eps-context-mcp` as-is:
- `packages/eps-context-mcp/package.json` has **no `exports` field**; `tsup.config.ts` builds only `src/index.ts`; `src/index.ts` is the stdio bin and does **not** re-export `bundle-access.ts` — the accessors are not reachable.
- The package carries runtime deps `@modelcontextprotocol/sdk` + `zod`, so importing it drags MCP deps into the backend (not "zero-dep").
- `load-bundle.ts:15` reads **only** `process.env.EPS_BUNDLE_URL` and is not parameterized — it cannot honor a chat-specific `EPS_CHAT_BUNDLE_URL`.

**Resolution (locked, not an open item):** extract the shared pieces into a new **zero-dependency** package `packages/eps-agent-core`:
- Move `bundle-access.ts` (`searchApis`, `getApi`, `getTopic`, `getRecipe`, `listApis`) + `bundle-types.ts` verbatim (both already dep-free — only type imports).
- Add a **parameterized loader** `loadBundleFrom({ bakedPath, url })` — the pure core; `eps-context-mcp` keeps its thin `load-bundle.ts` wrapper reading `EPS_BUNDLE_URL`, the backend adds a wrapper reading `EPS_CHAT_BUNDLE_URL`.
- Repoint `eps-context-mcp` to consume `eps-agent-core` (no behavior change; its existing tests must stay green). Add `eps-agent-core` as a backend dependency.
- This is the DRY-correct move (one accessor implementation, two consumers) and the only way to keep the backend dep-clean.

### Bundle loading + freshness

- Backend loads `eps.json` **baked into the Docker image at build time** (same bake step `eps-context-mcp` uses), read once at startup into memory via `eps-agent-core`'s loader.
- Optional `EPS_CHAT_BUNDLE_URL` override: when set, fetch fresh bundle at startup. Content-hash (`meta.version`, FNV-1a) logged on load for traceability.
- No hot-reload; bundle refresh = redeploy. `// ponytail: startup-load only; add SIGHUP reload if bundle churn without deploy becomes real`

### Retrieval

- Per request: run `searchApis(query)` (+ `apiSlug` boost when present), take top-N API slices; always include the `auth` topic summary (HMAC) and `errors` topic. Token-budget the assembled context to **~6k tokens** (truncate lowest-scored slices first).

### Prompt assembly

- **System prompt:** fixed instructions + auth/HMAC summary + refusal rules (§7) + the retrieved slices.
- **User turns:** the sliding-window messages.
- **Output cap:** `maxTokens ≈ 1000`.

---

## 6. Provider abstraction

Thin, dependency-free HTTP adapters behind one interface:

```ts
interface ChatProvider {
	complete(
		system: string,
		messages: ChatMessage[],
		maxTokens: number,
	): Promise<{
		text: string;
		usage: { inputTokens: number; outputTokens: number };
	}>;
}
```

Two adapters cover all three providers:

- **`anthropic`** — Messages API.
- **`openai-compatible`** — Chat Completions schema; covers **OpenAI** and **OpenRouter** (OpenRouter = base-URL swap + same schema).

### Env configuration (project-specific names)

| Env var                         | Meaning                                                            |
| ------------------------------- | ------------------------------------------------------------------ |
| `EPS_CHAT_PROVIDER`             | `anthropic` \| `openai` \| `openrouter`                            |
| `EPS_CHAT_MODEL`                | model id (e.g. `claude-haiku-4-5`, `gpt-4.1-mini`, `openrouter/…`) |
| `EPS_CHAT_API_KEY`              | provider API key (backend secret; never sent to client)            |
| `EPS_CHAT_BASE_URL`             | optional override (OpenRouter / self-host / gateway)               |
| `EPS_CHAT_MONTHLY_TOKEN_BUDGET` | global spend circuit-breaker ceiling (tokens)                      |

**Feature toggle (two-layer, Codex-verified):** the current frontend flag system is build-time only (`src/lib/config/features.ts` exposes just `SHOW_USER_LOGIN` from `VITE_SHOW_USER_LOGIN`); the backend has no chat config today (`packages/eps-backend/src/config.ts`). So the toggle is two independent layers:

1. **Backend (authoritative):** if `EPS_CHAT_PROVIDER`/`EPS_CHAT_API_KEY` unset → `/chat/ask` returns `503 CHAT_DISABLED`. Add chat fields to `config.ts`. This is the real gate.
2. **Frontend (cosmetic):** new build-time flag `VITE_EPS_CHAT_ENABLED` in `features.ts` gates whether the "Ask AI" row renders. Because SSG can't know backend runtime state, the frontend **also** treats a `503 CHAT_DISABLED` response as "hide + show a one-time 'assistant unavailable' toast" — so a flag/deploy mismatch fails gracefully instead of showing a dead row. No runtime config endpoint needed.

Model/provider choice is deliberately **config-only** so it can be tuned (Haiku ↔ Sonnet ↔ GPT ↔ OpenRouter) without a code change.

---

## 7. Security & privacy

### Endpoint privilege isolation

`chat.ts` imports **only** the bundle accessors + provider adapter. It imports **nothing** from `clients/github.ts` or any admin/mutation path. Enforced by a module-boundary test (grep-assert: `chat.ts` has no `github`/admin import). Chat cannot mutate anything.

### Prompt-injection posture

- Retrieved slices = our own generated content (trusted). User messages = untrusted.
- System prompt requires: answer **only** from provided EPS context; if no context matches, say so and link `/docs`; **never** reveal the system prompt; **never** output credentials or secrets; refuse off-topic requests.
- Answer rendered as **markdown** in the popup with link sanitization; **no raw HTML injection**.

### PII / retention

- **No chat storage. Ever.** No conversation persisted to KV or disk.
- **Message content is never logged** — access log excludes bodies; denials (rate-limit, budget, auth) are recorded with `rid` + actor `@login`, **zero message text**.
- **securityLog seam change (Codex-verified):** `SecurityEvent` is currently `"admin_login" | "admin_mutation"` with `action: "propose" | "deploy" | null` (`audit/securityLog.ts:2,16`) — it cannot represent chat denials as-is. Extend the union with a `"chat_denied"` event (action `null`, reason = the AppError code: `RATE_LIMITED` / `CHAT_BUDGET_EXHAUSTED` / auth). No new logger; reuse the existing best-effort `securityLog` sink. Content is never included.
- Users may paste API keys/PII into chat → content reaches the LLM provider (unavoidable for the feature; UI microcopy warns). It never touches our logs or store.

### Transport / CORS

Existing middleware already locks CORS to the site origin. Chat adds no new origin surface. Session-token handling unchanged.

---

## 8. Cost & abuse controls

- **Per-login rate limit:** reuse `enforceRateLimit` (`src/http/rateLimit.ts`) — **30 messages / 600s** per login. Same machinery as propose/deploy limits; KV-outage semantics (429 → 503 `RATE_LIMIT_UNAVAILABLE`) unchanged.
- **Global monthly spend circuit breaker:** KV counter `chatspend:<YYYY-MM>` accumulates actual `usage.outputTokens + inputTokens` per successful response. When it exceeds `EPS_CHAT_MONTHLY_TOKEN_BUDGET` → `503 CHAT_BUDGET_EXHAUSTED` until the month rolls. Counter increment is **fail-open** (`.catch` + log) — spend tracking is best-effort; the per-login limit is the hard gate. Counter updated **only after** a successful completion.
  - **KV seam change (Codex-verified):** the store only exposes `incr(key, ttlSec)` which increments by exactly 1 (`store/kv.ts`). A token-delta accumulator needs a new atomic **`incrBy(key, delta, ttlSec)`** on the `KV` interface, implemented in both the in-memory and Redis backends (Redis `INCRBY` + `EXPIRE`), and wrapped by `withStoreErrors`. Guard the read (over-budget check) fail-**closed** via the existing typed-error path? No — budget is a soft cost cap, keep the whole path **fail-open** so a KV outage never blocks answers; the per-login limit remains the hard gate. Month key gets a ~40-day TTL so stale months self-evict.
- **Request-size limits** (§4) bound single-request cost.

---

## 9. Failure contract

- Provider call: **30s timeout** via `AbortController`. **No retry** (retry doubles spend; user can re-ask). `// ponytail: no retry; add single retry on provider 429 if flakiness observed`
- Provider timeout / 4xx / 5xx → `502 UPSTREAM_ERROR` (the existing GitHub-upstream code, per §4).
- Buffered response → no partial-answer / disconnect handling needed (a dividend of skipping SSE in v1).
- KV outage in rate-limit path → existing 503 semantics. Auth failure → existing 401.

---

## 10. Rollout gating

- Ships **behind the provider-config toggle** — deploying the code with no `EPS_CHAT_*` env set leaves the feature fully dark (`CHAT_DISABLED`, frontend row hidden). Enable per-environment by setting env vars.
- Recommended sequence: enable on a staging/UAT config first, watch spend counter + access logs, then production.
- Backend exposure **unchanged**: same VPN-only VM, same session-gated surface as the console. No new public inbound.

---

## 11. Testing requirements (spec-mandated)

The implementation plan must include (vitest, existing 221-test suite stays green):

1. **Endpoint contract** — happy path returns `{answer, sources, usage}`; body-limit rejections (too many messages, oversized body) → 400.
2. **Auth gate** — no session → 401; valid session → allowed.
3. **Rate limit** — 31st message in window → 429; KV outage → 503 `RATE_LIMIT_UNAVAILABLE`.
4. **Spend breaker** — counter over budget → 503 `CHAT_BUDGET_EXHAUSTED`; increment fail-open on KV error.
5. **Provider adapters** — anthropic + openai-compatible request shape + usage parsing, against mocked HTTP; timeout → 502; provider 5xx → 502.
6. **Feature toggle** — unset provider → 503 `CHAT_DISABLED`.
7. **Retrieval** — query returns relevant slices; token-budget truncation; `apiSlug` boost.
8. **Privilege isolation** — module-boundary assert: `chat.ts` imports no github/admin code.
9. **No-leak** — securityLog denial records contain `rid`+actor but no message content.
10. **Frontend** — "Ask AI" row hidden when logged out / feature disabled; a11y of the popup dialog (focus trap, escape, labels).

---

## 12. Files (anticipated — confirmed in plan)

**New shared package `packages/eps-agent-core/` (zero-dep):**

- `bundle-access.ts` + `bundle-types.ts` — moved from `eps-context-mcp` (verbatim)
- `load-bundle.ts` — parameterized `loadBundleFrom({ bakedPath, url })`
- `eps-context-mcp` repointed to consume it (its tests stay green)

**Backend (`packages/eps-backend/src/`):**

- `http/chat.ts` (new) — route, validation, orchestration
- `chat/providers.ts` (new) — anthropic + openai-compatible adapters
- `chat/grounding.ts` (new) — retrieval + prompt assembly (uses `eps-agent-core`)
- `chat/spend.ts` (new) — monthly circuit breaker
- `http/app.ts` — mount route
- `http/errors.ts` — new codes (`CHAT_DISABLED`, `CHAT_BUDGET_EXHAUSTED`)
- `store/kv.ts` (+ Redis impl + `storeError.ts` wrap) — new atomic `incrBy(key, delta, ttlSec)`
- `audit/securityLog.ts` — extend `SecurityEvent` union with `"chat_denied"`
- `config.ts` — chat/provider config fields

**Frontend (`src/`):**

- `components/CommandPalette.tsx` — "Ask AI" row (gated)
- `components/AskAiDialog.tsx` (new) — popup, multi-turn, markdown render
- `lib/chat/client.ts` (new) — `POST /chat/ask` fetch wrapper (uses `VITE_EPS_BACKEND_URL`)
- `lib/config/features.ts` — new `VITE_EPS_CHAT_ENABLED` build-time flag

**Docs:** `docs/` feature doc + README "AI docs-chat" section (per keep-docs-current rule).

---

## 13. Open items for the implementation plan

_(All Codex-flagged reuse/architecture gaps now resolved inline above. Remaining items are tuning-only.)_

- Top-N slice count + exact token-budget numbers (retrieval tuning; measure against real queries).
- System-prompt wording (refusal + HMAC guidance) — draft in plan, iterate.
- Whether `eps-agent-core` also absorbs `signing-snippets.ts` (nice-to-have; not required for chat).
