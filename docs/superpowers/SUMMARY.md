# Superpowers SDD — index

This folder holds spec-driven-development (SDD) artifacts. The verbose per-feature plans and
specs were pruned once shipped — the code and its user-facing docs are the source of truth.
Only **active, not-yet-implemented** designs are kept here in full.

## Active

_(nothing — every design in this folder has shipped.)_

## Delivered (plans/specs pruned; see the merge commit + committed doc)

| Feature | Merged to `dev` | Documented in |
|---|---|---|
| eps-backend auth foundation (OTP + admin GitHub OAuth) | on main/dev | `packages/eps-backend/README.md` |
| Admin config console (GitOps MDX editor) | `29a9a3b` | `docs/admin-console.md` |
| Console auth UI (login/OTP flow) | (login UI) | `docs/console-roadmap.md` |
| Console left nav (rail + Home/Credentials sub-pages) | `9b87e4f` | `docs/console-roadmap.md` |
| Redis KV durability | `b32c88f` | `packages/eps-backend/README.md` |
| VM auto-deploy (pull-based GHCR → private VM) | `4b08c52` | `docs/eps-backend-vm-deploy.md` |
| Admin authz freshness + broadened rate-limiting | `fe6d9fc` | `packages/eps-backend/README.md` |
| Security event log + otp/verify 503 | `6f0f50f` | `packages/eps-backend/README.md` |
| Correlation-IDs + access log | `2d10751` | `packages/eps-backend/README.md` |
| KV fail-open/closed matrix + STORE_UNAVAILABLE | `81991b0` | `packages/eps-backend/README.md` |
| AI-native platform — phases 0-4 + roadmap (context packs, eps-context-mcp, SDKs, harness) | PR #43 | `docs/ai-agent-platform.md`, `docs/sdk-golden-vector.md` |
| Production-hardening (umbrella; all items above) | — | `packages/eps-backend/README.md` |
| Hosted context MCP (`/context/*`, in-process) | `a734cc3` | `packages/eps-backend/README.md` |
| Phase 4 AI docs-chat (`POST /chat/ask`) | _pending_ | `docs/docs-chat-agent.md` |

## Elsewhere (not on `dev`)

- Welcome landing-page variants (design + plan) live on branch
  `feature/welcome-landing-pages` (commits `772ea27` design, `7d90662` plan). Unmerged;
  kept with that branch rather than duplicated here.
