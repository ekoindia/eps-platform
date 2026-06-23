# AI-Native: Gap Analysis

Today EPS is **agent-ready / AI-friendly** — it ships machine-readable artifacts (context, SDKs, packs, mock, OpenAPI) generated from one source of truth. That is real and strong. But "AI-native" implies agents are first-class **actors** with a closed loop and **proof** they succeed. That bar is not met yet. This doc defines the bar and the work to clear it.

## The distinction

| | AI-friendly (today) | AI-native (target) |
|---|---|---|
| Agent role | Reads docs/context, integrates | Acts, verifies, self-corrects |
| Platform shape | Exposes artifacts *to* agents | Built *around* the agent loop |
| Proof | "Should work" | Measured agent success (evals) |
| Maturity | Prototype, unpublished | Published, adopted, observed |

## What's already built (the foundation — keep)

- Single source-of-truth data layer → all artifacts regenerate in sync.
- MCP server (read tools: list/search/get APIs, topics, recipes, signing snippets).
- Context packs: `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `copilot-instructions.md`.
- Backend SDKs (JS + PHP) with HMAC signing + cross-language golden-vector conformance.
- Offline mock server with recipe-aware branching.
- Claude Code plugin (skills: integrate-eps, sign-request, run-a-recipe).
- 12-harness install matrix; LLM markdown (`/llms.txt`); OpenAPI + Postman.

This is a genuine moat on the *correct-by-default* hard parts (signing, recipes). It earns "agent-ready." It does not yet earn "AI-native."

## Gaps to earn "AI-native"

Priority order. The first four flip the label from readable → native.

### 1. Close the loop — actions, not just context (P0)
MCP is read-only. Add **guarded action tools** so the agent can *do*:
- `run_call_in_sandbox` — execute a signed API call against sandbox, return real response.
- `scaffold_integration` — emit working integration code for a chosen flow.
- `validate_signature` — check the agent's signing output against the golden vector.
- `run_conformance` — run the agent's integration against fixtures, return pass/fail.
Keep backend-only/no-secrets discipline; secrets never enter the agent context.

### 2. Verification / feedback loop (P0)
Agent must get pass/fail and self-correct without a human. Build on the mock server: an **agent-runnable conformance harness** + structured **error explainers** mapping EPS error codes → cause → fix.

### 3. Evals — proof + moat (P0)
A suite that measures: *can agent X integrate flow Y end-to-end from cold?* Run across the 12 harnesses; track success rate over time. No evals → "AI-native" is marketing. Evals → it's true and defensible. This is also the best slide in any future deck.

### 4. Published + adopted (P0)
A platform has users. At `0.1.x` unpublished it's a prototype. Ship to npm / Packagist / Claude marketplace (see [releasing-agent-packages.md](releasing-agent-packages.md)).

### 5. Coverage or honest capability manifest (P1)
Partial rails → agent hits a gap → trust dies. Either complete the API rails, or expose a **machine-readable capability manifest** ("what I can / can't do") the agent reads so it never over-promises. See [api-coverage-roadmap.md](api-coverage-roadmap.md).

### 6. Live freshness (P1)
Packs are baked snapshots. Add a **version + changelog** the agent can read, and finish remote-refresh (the `EPS_BUNDLE_URL` hook already exists) so the agent always gets current truth.

### 7. Agent self-serve onboarding (P1)
Sandbox-key provisioning guided by the agent, not a manual portal step. Preserve no-secret-leak rules.

### 8. Telemetry (P2)
See which APIs agents use and where they fail. Feeds evals + roadmap. None today.

### 9. Governance / safety (P2, ongoing — regulated domain)
Guardrails the agent must respect: sandbox-vs-prod gating, rate limits, no-secret-leak enforcement, compliance checks. Partially baked (backend-only, no secrets in packs); formalize and make agent-visible.

## Recommended labels by stage

- **Now:** "agent-ready fintech platform" / "built for AI builders." Honest, still differentiated.
- **After #1–#4:** "AI-native fintech developer platform." Earned, with evals to back it.

## Definition of done for the claim

We can call it AI-native when, from a cold start, an AI agent can: discover EPS → scaffold an integration → run it in sandbox → verify pass/fail → self-correct — using published packages, with a measured success rate we can show.
