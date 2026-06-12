# /welcome Landing Pages — Design Spec

**Date:** 2026-06-11
**Status:** Approved (brainstorming phase)
**Source:** EPS 2.0 Strategic Blueprint + EPS 2.0 Platform Monorepo design spec

## 1. Goal

Three new ultra-modern, AI-native landing pages that market EPS 2.0 (open-source, agent-first, self-serve fintech API platform) without touching the existing home page (`/`):

| Route | Codename | Role |
|---|---|---|
| `/welcome` | **A — The Agent Demo** | Primary candidate. Cinematic scrollytelling: an AI agent integrates Eko live as you scroll. |
| `/welcome2` | **B — Layered Stack** | Premium classic dark-SaaS arc. Safe fallback / A-B variant. |
| `/welcome3` | **C — Terminal as Canvas** | Radical: whole page is one terminal session. A-B variant. |

Decisions locked during brainstorming:

- **Audience/CTA:** developers; #1 conversion = "Get sandbox key".
- **Visual direction:** "Obsidian Terminal" — near-black canvas, gold ignition accents, monospace pulses (Linear/Vercel-class dark).
- **Motion tech:** zero-dependency — CSS 3D transforms, IntersectionObserver, small rAF hooks. No framer-motion/GSAP.
- **Chrome:** standalone immersive — global Header suppressed on `/welcome*`; pages own a minimal dark nav + slim dark footer.
- **Claims:** vision page — copy markets EPS 2.0 as live (it is in active build per the monorepo spec). Section 2 of page A restricts itself to verification APIs (truthful to Phase 1 scope; zero money movement).
- **CTA wiring (until portal ships):** "Get sandbox key" → existing `/signup`; Docs → `https://developers.eko.in`; GitHub → `https://github.com/ekoindia`.
- All three pages `noindex` (Helmet) and excluded from the sitemap — preview/A-B pages must not compete with `/` in search.

Detailed per-page storyboards (sections, copy, motion specs) live in
[`docs/welcome-landing-storyboards.md`](../../welcome-landing-storyboards.md) — that file is the
content source of truth for implementation; this spec defines architecture and quality bars.

## 2. Architecture

### Routes & registration

- Lazy routes in `src/App.tsx` (same pattern as existing pages).
- Routes appended to `ssg/routes.ts` for prerender.
- Sitemap generation must skip `/welcome*` (noindex pages).

### Chrome suppression

- `Header.tsx` already reads `location.pathname`; return `null` when path starts with `/welcome`.
- Each page renders `WelcomeNav` (Eko logo, Docs, GitHub, gold "Get sandbox key") and `WelcomeFooter` (legal links, © Eko).

### File layout

```
src/pages/welcome/AgentDemoPage.tsx        → /welcome
src/pages/welcome/LayeredStackPage.tsx     → /welcome2
src/pages/welcome/TerminalCanvasPage.tsx   → /welcome3
src/components/welcome/
  WelcomeNav.tsx, WelcomeFooter.tsx
  CodeTabs.tsx            # MCP/SDK/CLI tab triplet (shared by A§3, B§4)
  IgnitionCta.tsx         # gold-bloom final CTA (shared by A§6, B§6)
  motion/
    useScrollProgress.ts  # rAF-throttled 0→1 progress of element through viewport
    useReveal.ts          # IntersectionObserver → `is-visible` class, staggered children
    useMouseParallax.ts   # pointer-driven rotateX/rotateY, desktop only
    usePrefersReducedMotion.ts
```

### Motion system (zero-dep)

- Only `transform` and `opacity` are animated; `perspective` set on parents; `will-change` only on actively animating nodes.
- Single rAF loop per page for scroll progress.
- `usePrefersReducedMotion` gates everything: reduced-motion = fully static page with all content visible (pinned scrollytelling degrades to a plain vertical list).
- All hooks guard `typeof window` / `IntersectionObserver` existence (SSG node env); no-op fallback = static page.

### SSG safety

- Prerendered HTML contains full content. Base state is visible; JS adds a `js-motion` root class and only then applies animated initial states. No content hidden behind JS-only `opacity: 0`.

### Visual system

- Canvas `#07090d`; radial gold blooms (`radial-gradient`, not blur filters); faint dot-grid.
- Type: Inter for display (clamp ~3.5–6rem H1, −2% tracking), JetBrains Mono for terminal/code/labels.
- `--color-eko-gold` reserved for accents + CTAs only — scarcity keeps it premium.

## 3. Build process

- Page A built first, in-conversation — establishes motion primitives and shared components.
- Pages B and C dispatched to parallel subagents afterwards (they reuse A's primitives), reviewed before merge.

## 4. Error handling

- Marketing pages: no data fetching; existing route-level `ErrorBoundary` wraps all routes.
- Motion hooks no-op when APIs are missing rather than throwing.
- Verify the pinned section on A does not conflict with `PageTransition`/`AnimatedRoutes` or `ScrollToTop`.

## 5. Testing

- Vitest per page (jsdom): renders without crash; H1 + CTA links present; `noindex` meta set; Header returns `null` on `/welcome*`.
- Reduced-motion unit test: mock `matchMedia` → no pinned wrapper, full content in DOM.
- Build: `npm run build` prerenders all three routes; preview spot-check **with trailing slash** (known vite-preview no-slash fallback quirk).
- Manual: Chrome DevTools scroll-performance trace on `/welcome` pinned section.

## 6. Performance budget

- No raster images — pure CSS/SVG/text; small lazy-loaded route chunks.
- 60fps scroll target on the pinned section; transform/opacity-only animation discipline.

## 7. Out of scope

- Any change to the existing home page (`/`), Header behavior on non-welcome routes, or global styles.
- Real portal/sandbox-key issuance (links go to existing `/signup` until the portal ships).
- Public launch/SEO for these pages (noindex until promoted).
