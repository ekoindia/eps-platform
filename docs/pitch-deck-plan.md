# EPS Platform — Strategic Buy-In Deck (Plan)

**Purpose:** Secure internal Eko leadership alignment that EPS has become an **AI-native fintech developer platform**, not a marketing website. This is a vision + direction greenlight; funding follows.

**Audience:** Eko founders / execs / product + eng heads. They know fintech and EPS — do **not** re-explain the product. Spend the time on the *strategic shift*, *why now*, the *proof we already shipped*, and *what a greenlight unlocks*.

**Format:** ~16 slides, ~20 min + Q&A. Each slide below = title · key message · content · suggested visual.

**Grounding (real, shipped in ~2 weeks, June 6–20 2026):** repositioned site → platform; 5 packages (MCP server, JS SDK, PHP SDK, mock server, Claude Code plugin); 6 API spec phases shipped (nomenclature + PPI rails, user/agent + customer mgmt, AePS fund settlement, txn inquiry + refunds, bank/IFSC + BBPS helpers); single-source-of-truth build → OpenAPI, Postman, agent bundle, context packs, fixtures, install matrix, LLM markdown; `/ai` hub with 12-harness install matrix; CI + release workflows (npm OIDC trusted publishing); golden-vector cross-language signing conformance.

---

## Slide 1 — Title

- **Key message:** EPS is now a platform.
- **Content:** "EPS Platform — the AI-native way to build on Eko's fintech rails." Subtitle: Strategic review for leadership · June 2026. Presenter + date.
- **Visual:** Clean EPS Platform wordmark on dark (Obsidian Terminal palette already in brand). One-line tagline beneath.

## Slide 2 — The shift, in one line

- **Key message:** We changed what EPS *is*.
- **Content:** Before → a marketing website that *describes* our APIs. After → a platform that *generates everything* needed to integrate them — for developers and their AI agents. Same rails, radically better distribution.
- **Visual:** Two-box before/after. Left: "Website (brochure)". Right: "Platform (SDKs + MCP + agent context + mock + docs, auto-generated)". Arrow between.

## Slide 3 — Why now

- **Key message:** Developers no longer read docs — their AI agents do.
- **Content:** AI coding agents (Claude Code, Cursor, Copilot, etc.) are now the default way integrations get built. They consume machine-readable context, not PDFs. Whoever is *easiest for an agent to integrate* wins the developer. Fintech integration is uniquely painful (signing, multi-step flows, compliance) — exactly where agents fail without good context.
- **Visual:** Trend arrow — "human reads docs" → "agent reads context." Small logos of agent harnesses we already support.

## Slide 4 — The thesis

- **Key message:** One source of truth → everything regenerates in sync.
- **Content:** We describe each API once in a data layer. The build emits SDKs, MCP server, OpenAPI, Postman, AI context packs, mock fixtures, and docs — all from that single source. Edit once, every artifact updates. Zero drift, zero duplicated maintenance.
- **Visual:** Hub-and-spoke: center "api-specs (source of truth)" → spokes to SDK / MCP / OpenAPI / Postman / context packs / mock / docs.

## Slide 5 — Proof: what we shipped in 2 weeks

- **Key message:** This isn't a proposal — it's already built.
- **Content:** Timeline of June 6–20: 5 packages, 6 API phases, CI/release pipeline, /ai hub, full repositioning. Emphasize velocity — small team, two weeks, working artifacts.
- **Visual:** 2-week timeline / commit-density graphic. Callout numbers: **5 packages · 6 API phases · 12 agent harnesses supported.**

## Slide 6 — The platform surfaces

- **Key message:** Five ways to integrate, all generated.
- **Content:** (1) MCP server — live API context inside any agent. (2) Backend SDKs — JS + PHP, signing built in. (3) Drop-in context packs — CLAUDE.md / AGENTS.md / .cursorrules / Copilot. (4) Offline mock server — test without live calls. (5) Claude Code plugin — one-command install. Plus OpenAPI + Postman for the classic path.
- **Visual:** 5 product tiles with icons; small "+OpenAPI/Postman" footnote.

## Slide 7 — The moat: we solved the hard parts

- **Key message:** Generic API tooling gets fintech wrong. We don't.
- **Content:** Per-request HMAC-SHA256 signing baked into every SDK + pack, with cross-language golden-vector conformance tests. Multi-step recipes encoded (e.g. DMT `463 → onboard sender`) so agents handle real flows, not just single calls. Correct-by-default integration is the defensible edge.
- **Visual:** "Generic OpenAPI ❌ signing / ✅ ours" comparison; a snippet of the recipe branch.

## Slide 8 — Why this matters to Eko (the business case)

- **Key message:** Easier integration = faster revenue + lower cost.
- **Content:** Shorter time-to-first-transaction for partners → revenue starts sooner. Fewer integration support tickets → lower cost to serve. Presence in agent ecosystems (npm, Packagist, Claude marketplace) → organic developer distribution we don't pay for. AI-native positioning → differentiation vs other Indian fintech API vendors.
- **Visual:** 4 outcome cards: ⏱ time-to-integrate ↓ · 💬 support load ↓ · 📈 distribution ↑ · 🥇 differentiation.

## Slide 9 — Competitive positioning

- **Key message:** First AI-native fintech API platform in our market.
- **Content:** Most competitors ship a portal + PDF + maybe one SDK, all hand-maintained and drifting. We ship an always-in-sync, agent-first toolchain. Frame as a window of advantage, not a permanent lead — speed to GA matters.
- **Visual:** 2x2 or simple table: us vs typical vendor across {SDK coverage, AI/agent support, docs freshness, signing correctness}.

## Slide 10 — What "good" looks like (KPIs to move)

- **Key message:** We'll measure the shift.
- **Content:** Proposed metrics: time-to-first-successful-API-call (partner onboarding), # integrations via SDK/MCP, integration-related support tickets, package installs / marketplace adds, developer NPS. Set baselines now, target movement post-GA.
- **Visual:** KPI dashboard mock — 5 tiles, "baseline → target."

## Slide 11 — Where we are today (honest status)

- **Key message:** Built and working, not yet launched.
- **Content:** Packages at `0.1.x`, validated locally, **not yet published** to npm / Packagist / public marketplace. API coverage is a strong but growing subset (phases 0–6 done; more rails to add). Publishing needs final credentials + sign-off (see docs/releasing-agent-packages.md).
- **Visual:** Progress bar per workstream (Specs / SDKs / MCP / Plugin / Publish) — most green, "Publish" amber.

## Slide 12 — The ask

- **Key message:** Greenlight EPS as a platform.
- **Content:** Endorse the repositioning as official direction. Approve moving from 0.1.x → GA (publish packages, expand API coverage, GTM to developers). Name an exec sponsor. (Detailed budget/headcount in a follow-up.) Be explicit: today we want *direction approval*, money next.
- **Visual:** Three checkboxes: ☐ Endorse direction · ☐ Approve path to GA · ☐ Assign sponsor.

## Slide 13 — Roadmap if greenlit

- **Key message:** Clear path from here to launch.
- **Content:** Near-term: publish packages, complete remaining API rails, public launch of /ai hub. Mid-term: usage analytics, more SDK languages, deeper recipes/skills, partner pilots. Long-term: EPS as the default fintech integration layer for AI builders in India.
- **Visual:** 3-horizon timeline (Now / Next / Later) with 2–3 items each.

## Slide 14 — Risks & mitigations

- **Key message:** We've thought about what could go wrong.
- **Content:** (1) Adoption uncertainty → start with partner pilots + measure. (2) Maintenance load → mitigated by single-source-of-truth (the whole point). (3) Security/compliance of published SDKs → backend-only design, no secrets shipped, conformance tests. (4) Window closes if we're slow → bias to publish.
- **Visual:** 2-column risk → mitigation table.

## Slide 15 — Close

- **Key message:** Same rails. New leverage.
- **Content:** Restate the one-liner: "EPS Platform — the AI-native way to build on Eko's fintech rails." We already proved we can build it fast. Ask for the greenlight to finish and launch.
- **Visual:** Wordmark + tagline, single CTA line.

## Slide 16 — Appendix (optional, for Q&A)

- **Key message:** Backup depth on demand.
- **Content:** Architecture diagram (source-of-truth pipeline), full package list + install commands, API coverage roadmap, golden-vector signing detail, release/publishing plan. Pull from docs/ai-agent-platform.md, docs/api-coverage-roadmap.md, docs/releasing-agent-packages.md, docs/sdk-golden-vector.md.
- **Visual:** Index slide linking to backup exhibits.

---

## Build notes

- **Tone:** confident, evidence-first. Lead every business claim with the shipped proof — leadership respects "already done" over "we could."
- **Length discipline:** core story is slides 2–12. Slides 13–16 are support; cut to fit time.
- **Reusable assets:** brand palette + components exist in repo (ds-bundle, Obsidian Terminal theme); the /ai hub page itself makes a strong live demo — consider a 60-sec screen capture instead of static slide 6.
- **Source docs to cite in speaker prep:** docs/ai-agent-platform.md, docs/ai-agent-platform-status.md, docs/api-coverage-roadmap.md, docs/releasing-agent-packages.md, docs/industry-and-packs-plan.md.
