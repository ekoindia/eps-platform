# Instructions for AI Coding Agents

> SEO-optimized marketing website for [Eko Platform Services](https://eps.eko.in).

## Commands

```sh
npm run dev          # Dev server (HMR)
npm run build        # Production build + SSG pre-render + sitemap
npm run lint         # ESLint
npm run test         # Vitest (single run)
npm run preview      # Preview production build locally
```

## Architecture at a Glance

- **Data-driven pages** — Product, Industry, and Solution pages are generated from data in [`src/lib/data/`](src/lib/data/). Edit data there, not individual page files.
- **SSG + SPA hybrid** — All routes are pre-rendered to static HTML at build time ([docs/static-page-generation.md](docs/static-page-generation.md)). Client hydrates on idle/interaction.
- **Dual App entry** — [`App.tsx`](src/App.tsx) (client, `React.lazy`) vs [`AppServer.tsx`](src/AppServer.tsx) (SSG, eager imports). New routes must be added to **both**.
- **Route manifest** — [`ssg/routes.ts`](ssg/routes.ts) is the single source of truth for all pre-rendered routes. Add new routes there too.
- **Markdown generation** — AI-agent-friendly `.md` versions of every page are generated at build time ([docs/markdown-generation.md](docs/markdown-generation.md)).

## Coding Conventions

### Layouts & Components — Reuse, Don't Duplicate

| Layout | Use for |
|--------|---------|
| `ProductPageLayout` | All `/products/*` pages — pass props, don't create custom layouts |
| `SolutionPageLayout` | All `/solutions/*` pages |
| `IndustryPageLayout` | All `/industries/*` pages |
| `SectionContainer` | Every page section — enforces consistent padding & variants (`default` / `navy` / `muted`) |
| `SectionHeader` | Badge + title + subtitle heading blocks |

- **Extract shared UI into components.** Before creating inline markup, check `src/components/` and `src/components/ui/` for existing primitives (shadcn/ui + Radix).
- **Cards follow a pattern:** `ProductCard`, `UseCaseCard`, `FeatureCard`, `StatCard` — use them; don't create ad-hoc card markup.
- **Animations:** Wrap lazy-visible content in `<FadeIn>`. Use existing Tailwind animations (`fade-up`, `fade-in`, `slide-left`, `slide-right`, `float`, `pulse-soft`).

### Styling

- **Tailwind CSS only.** No inline styles, no CSS modules.
- **Brand palette:** `eko-gold`, `eko-navy`, `eko-slate`, `eko-success` + hover/light variants. Use them instead of raw hex/HSL values.
- **Fonts:** Inter (sans), JetBrains Mono (mono). Configured in Tailwind.
- **Shadows:** Use semantic tokens: `shadow-card`, `shadow-card-hover`, `shadow-gold`, `shadow-navy`.

### TypeScript

- Strict mode. Interfaces for all component props.
- Functional components only.

## SEO Rules — Mandatory for Every Page

### Meta & Head

1. **Helmet is required** on every page. Set `title`, `meta description`, `keywords`, `og:*`, `twitter:*`.
2. **DefaultMeta** ([`src/components/DefaultMeta.tsx`](src/components/DefaultMeta.tsx)) provides fallback meta. Page-level `<Helmet>` overrides it.
3. **Canonical URL** — always set `<link rel="canonical">` pointing to `SITE_URL` + path.
4. **Site constants** live in [`src/lib/config/site.ts`](src/lib/config/site.ts) — `SITE_URL`, `SITE_TITLE`, `SITE_OG_IMAGE`, etc. Import from there.

### Structured Data (JSON-LD)

5. **Product pages** must include JSON-LD via `generateProductJsonLd()` from [`src/lib/utils/json-ld.ts`](src/lib/utils/json-ld.ts). Schema types: `Organization`, `SoftwareApplication`, `BreadcrumbList`, `FAQPage`.
6. **Industry/Solution pages** must include `BreadcrumbList` and `FAQPage` JSON-LD.
7. **Test structured data** after changes at [Google Rich Results Test](https://search.google.com/test/rich-results).

### Content & Headings

8. **One `<h1>` per page.** Layout components handle this — don't add extra `<h1>` tags.
9. **Heading hierarchy must be sequential:** h1 → h2 → h3. Never skip levels.
10. **Descriptive link text.** Never use "click here" or "learn more" as sole link text.
11. **Alt text on all `<img>` tags.** Be descriptive: "AePS API integration flow diagram", not "image1".

### Performance (Core Web Vitals)

12. **Minimize DOM depth and node count.** Avoid unnecessary wrapper `<div>`s — use fragments (`<>`) or Tailwind on the semantic element directly.
13. **Lazy-load below-fold images** with `loading="lazy"`.
14. **Above-fold images** must use `fetchpriority="high"` and `loading="eager"`.
15. **No layout shift.** Always set explicit `width`/`height` or aspect-ratio on images and embeds.
16. **Code-split routes.** Use `React.lazy()` in `App.tsx` (client). Never eager-import page components on the client side.

## AI-Agent-Friendly Markup

### Semantic HTML

- Use `<button>` for actions, `<a>` for navigation — never a styled `<div>` or `<span>`.
- Use `<nav>`, `<main>`, `<section>`, `<article>`, `<header>`, `<footer>`, `<aside>` appropriately.
- All interactive elements must be keyboard-accessible (`tabindex`, focus styles).
- Add `aria-label` or `aria-labelledby` on sections/landmarks that lack visible headings.
- Use `<label for="...">` on all form inputs.

### Stable & Predictable Layout

- **Consistent element placement.** CTAs, navigation, and key actions must be in the same position across pages. Agents rely on spatial consistency.
- **No ghost/overlay elements** that hide interactive elements from visual analysis.
- **Interactive elements > 8px² visible area** so agents don't filter them out.
- **Set `cursor: pointer`** on all clickable elements — it's a strong agent signal.

### Markdown Alternate Content

- Every page must emit `<link rel="alternate" type="text/markdown">` pointing to its `.md` version.
- The `AiHint` component injects a visually hidden hint for LLMs pointing to the markdown URL.
- Markdown renderers live in [`src/lib/markdown/`](src/lib/markdown/) — update them when page data structures change.
- `/llms.txt` and `/llms-full.txt` are auto-generated indexes of all markdown content.

## Adding New Pages Checklist

1. Add data to the appropriate file in `src/lib/data/`.
2. Create the page component using the correct `*PageLayout`.
3. Add route to both `App.tsx` (lazy) and `AppServer.tsx` (eager).
4. Add route entry to `ssg/routes.ts`.
5. Update `Header.tsx` and `Footer.tsx` navigation if user-facing.
6. Ensure Helmet meta, canonical, and JSON-LD structured data are present.
7. Add markdown renderer if new page type (or update existing one in `src/lib/markdown/`).
8. Run `npm run build` and verify the pre-rendered HTML and sitemap.
