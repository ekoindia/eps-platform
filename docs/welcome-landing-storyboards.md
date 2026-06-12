# Welcome Landing Pages — Storyboards (A / B / C)

**Date:** 2026-06-11
**Status:** Approved content source-of-truth for `/welcome`, `/welcome2`, `/welcome3`
**Architecture/quality spec:** [`docs/superpowers/specs/2026-06-11-welcome-landing-design.md`](superpowers/specs/2026-06-11-welcome-landing-design.md)

Three design approaches for the EPS 2.0 landing page, all in the **Obsidian Terminal** visual
direction (near-black `#07090d`, gold ignition accents, Inter display + JetBrains Mono).
A is the primary candidate; B and C are built for detailed review and A-B testing.

Shared by all pages:

- Standalone immersive chrome: `WelcomeNav` (logo · Docs → developers.eko.in · GitHub → github.com/ekoindia · gold **Get sandbox key** → `/signup`) and `WelcomeFooter`.
- `noindex`; excluded from sitemap.
- Zero-dep motion: CSS 3D + IntersectionObserver + rAF; reduced-motion = fully static.

---

## A — The Agent Demo (`/welcome`)

**Thesis:** visitor watches an AI agent integrate Eko, live, as they scroll. Every scroll-step
proves "minutes, not weeks."

### 1 · Hero — Live Agent Session
- Radial gold bloom upper-right, faint dot-grid.
- Eyebrow (gold, letterspaced): `OPEN-SOURCE · AGENT-NATIVE · BUILT FOR BHARAT`
- H1: **"Fintech APIs your AI agent can ship."**
- Sub: "Verification, payouts and bill-pay for Bharat — open-source SDKs, an MCP server, and a first API call in under 10 minutes."
- CTAs: gold **Get sandbox key**; ghost **Star on GitHub**.
- Centerpiece: 3D-tilted terminal card (`perspective(1200px)` + mouse parallax), auto-typing loop:

  ```
  $ claude mcp add eko
  ✓ connected · 14 tools available
  > verify PAN ABCDE1234F for vendor onboarding
  ✓ verified · 240ms
  ```

- Typewriter: CSS steps + small JS interval; reduced-motion renders full transcript statically.
- Scroll hint: animated chevron + "scroll to watch the integration".

### 2 · The 60-Second Integration (pinned scrollytelling — showpiece)
- Tall section (~400vh); inner stage `position: sticky; top: 0`.
- `useScrollProgress` scrubs 4 steps; each = chat bubble (human ask) + agent tool-call card
  flying in from z-space (`translateZ(-600px) → 0`, opacity, slight rotateY) onto a 3D fan-stack:
  1. "Verify this vendor before payout" → `eko_verify_pan` ✓ name match
  2. `eko_verify_gst` ✓ active, GSTIN bound to PAN
  3. `eko_verify_bank` ✓ penny-less, account live
  4. Verdict card: **"Vendor cleared in 3 calls · 0.9s · ₹7.40"** — gold border glow
- Progress rail on left edge: 4 dots fill as steps complete.
- Desktop: step copy column fixed left, card stage right. Mobile/reduced-motion: plain vertical step list, no pin.
- **Scope guard:** verification APIs only — truthful to Phase 1; zero money movement.

### 3 · Three Surfaces, One Registry
- "One endpoint registry. Three doors in." MCP / SDK / CLI tabs, code panel morph-swaps:
  - `npx @eko-eps/mcp` (+ `claude mcp add eko`)
  - `const eko = new Eko({...}); await eko.verify.pan(...)`
  - `eko verify pan ABCDE1234F --json`
- Tabs auto-cycle until hover; subtle perspective tilt; copy buttons.

### 4 · Open by Default
- H2: **"Everything we build is open. The rails are regulated."**
- 3D orbit: repo cards (`@eko-eps/core`, `sdk`, `mcp`, `cli`, `llms-tools` — MIT badges) orbit a
  gold core labeled "Licensed rails · RBI/NPCI". CSS keyframe orbit; pauses on hover;
  reduced-motion = static ring layout.
- Sub-row chips: DCO sign-off · good-first-issues · API-credit bounties.

### 5 · Bharat Scale Strip
- Count-up on reveal (rAF, runs once): **241B+** UPI txns/yr · **17M+** developers ·
  **50,000+** Eko micro-entrepreneur network · **<10 min** to first call.
- Thin gold gradient hairlines; quiet section between two loud ones.

### 6 · Final CTA — Ignition
- Full-bleed radial gold bloom rising from bottom on reveal.
- H2: **"Your agent is ready. Are you?"**
- Gold **Get sandbox key** + ghost **Read the docs**; mono footnote: `llms-full.txt available · agents welcome`.
- Slim dark footer.

---

## B — Layered Stack (`/welcome2`)

**Thesis:** proven premium dark-SaaS arc (Modal/Neon class) with 3D accents everywhere, no
pinned scrubbing. Safer build, easiest to keep fast and accessible.

### 1 · Hero — Floating Stack
- H1: **"The open fintech stack for Bharat."**
- Three glass layers (Verify / Pay out / Collect) z-stacked at `translateZ` 0/−80/−160px,
  idle slow rotation + mouse parallax; each layer carries mini endpoint chips.
- Same CTA pair as A.

### 2 · Four Pillars
- Minutes-not-weeks · Compliant by default · Open by default · Built for Bharat's last mile.
- Cards rise staggered (`useReveal`, 80ms steps); hover lift `translateY(-4px) translateZ(20px)`.

### 3 · Products Bento
- Asymmetric grid: large tile **Onboard & Verify** (mini code snippet inside), medium
  **Pay Out** / **Collect**, small **Banking-at-the-Counter**, **Fleet/Workforce Verify**.
- Hover = 3D lift + gold border trace.

### 4 · Code / MCP
- Two-column: prose left scrolls; code panel right `position: sticky`.
- Tabs MCP/SDK/CLI — same snippets as A (shared `CodeTabs`).

### 5 · Open-source + Metrics
- Repo card row + count-up strip (condensed A§4 + A§5).

### 6 · CTA Finale
- Shared `IgnitionCta` component.

---

## C — Terminal as Canvas (`/welcome3`)

**Thesis:** the entire page is one giant terminal session; sections burst out of the shell
plane in 3D. Most radical; strongest gimmick risk; a11y handled explicitly.

### 1 · Boot
- Full-viewport terminal frame, scanline shimmer; `eko@bharat:~$ welcome_` types.
- Output renders H1 as oversized ASCII-bordered block; nav rendered as terminal tabs.

### 2 · Session Log = Page
Each section opens with a typed command; its output panel bursts out of the terminal plane
(`rotateX(12deg) translateZ(-300px) → flat`, scroll-triggered via `useReveal`):

| Command | Output |
|---|---|
| `$ eko verify pan ABCDE1234F` | JSON response panel → expands into verification products grid |
| `$ cat pillars.md` | markdown "renders" — mono → styled type flip |
| `$ git clone eko-eps` | progress bars → repo/OSS section |
| `$ eko stats --bharat` | count-up metrics as a table |

### 3 · `$ eko signup`
- CTA = giant Enter keycap; press animation on hover.
- Confirm line: `→ sandbox key issued in <60s`.

### Accessibility notes (C-specific)
- Real text throughout (no images of text); `aria-hidden` on decorative prompt glyphs.
- Reduced-motion: all output pre-expanded, no typing animation.
