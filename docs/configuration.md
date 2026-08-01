# Configuration Guide — Every Knob in One Place

A single index of **all configuration in this project** — what each file
controls, and when to edit it. Most "content" changes are data edits under
`src/lib/data/`; most "behaviour" changes are config under `src/lib/config/`,
the build files, or the per-platform deploy files.

> Rule of thumb: edit **data/config**, not generated output or individual page
> components. Pages, Markdown twins, the sitemap, and the pricing XLSX are all
> derived from the sources below at build time.

---

## 1. Site & brand constants

| File | Configures | Edit when |
|------|-----------|-----------|
| [`src/lib/config/site.ts`](../src/lib/config/site.ts) | Canonical `SITE_URL`, SEO defaults (`SITE_TITLE`, `SITE_DESCRIPTION`, `SITE_OG_IMAGE`), social links, sales mobile, signup path, `API_DEFAULT_VERSION`, parent-site links | Domain change, default SEO/social copy, default API version |
| [`src/lib/config/zoho.ts`](../src/lib/config/zoho.ts) | Zoho SalesIQ / chat + CRM integration constants | Chat widget or lead-routing changes |

Canonical links, AI-hint text, and JSON-LD all read `SITE_URL` from here — change it in one place.

## 2. Content data (products, industries, solutions)

Data-driven pages are generated from these — edit data here, not page components.

| File | Configures | Edit when |
|------|-----------|-----------|
| [`src/lib/data/api-products.ts`](../src/lib/data/api-products.ts) | Product registry: id, name, slug, href, category, `shortDesc`, `disabled` flag | Add/remove/hide a product |
| [`src/lib/data/api-product-pages.ts`](../src/lib/data/api-product-pages.ts) | Per-product **marketing/content**: hero, overview, features, benefits, use cases, who-should-use, integration steps, FAQs, SEO. **No technical API data** (that lives in the spec layer below) | Change product-page copy |
| [`src/lib/data/industries.ts`](../src/lib/data/industries.ts) | Industry pages: challenges, packs, use-case scenarios, FAQs | Add/edit an industry |
| [`src/lib/data/solutions.ts`](../src/lib/data/solutions.ts) | Solution packs: bundled APIs, workflow, comparisons, FAQs | Add/edit a solution pack |
| [`src/lib/data/common-faqs.ts`](../src/lib/data/common-faqs.ts) | Platform-agnostic FAQs: the commons appended to every product page, plus the global-only reference set. Answers are **markdown**; each carries one `FaqTag` category | Add/edit a cross-product FAQ |
| [`src/lib/data/bbps-operators.ts`](../src/lib/data/bbps-operators.ts) | BBPS biller/operator list (count referenced in `/products.md`) | Operator list changes |

### FAQ answers are markdown

Every FAQ rendered through `FaqSection` / `FaqAccordion`
([`src/components/sections/FaqSection.tsx`](../src/components/sections/FaqSection.tsx))
supports **bold**, `inline code`, links and bullet lists — GFM tables and
autolinks are deliberately not enabled. Internal links (`/docs/…`, `#anchor`)
client-navigate via react-router; everything else opens in a new tab.

Answers must stay plain text in two places, both handled centrally — do not
re-introduce per-call-site stripping:

- **JSON-LD** — `faqPageJsonLd` in [`src/lib/utils/json-ld.ts`](../src/lib/utils/json-ld.ts)
  is the only builder of `schema.org` FAQPage nodes, and runs `stripMarkdown`.
- **Command palette** — `buildFaqItems` in `src/lib/search-index.ts`, same helper.

`stripMarkdown` ([`src/lib/utils.ts`](../src/lib/utils.ts)) flattens the
documented subset above; it is not a full parser. If FAQ copy ever needs more,
render through an AST instead of widening the regexes.

Each entry in `common-faqs.ts` carries one `FaqTag` — `getting-started`, `auth`,
`testing`, `integration`, `ai`, `support`, `pricing`, `compliance`. Categories
are **mutually exclusive**: the `/docs/faqs` guide renders one section per tag,
so a second tag would show the same FAQ twice. Tests in `common-faqs.test.ts`
enforce that every global FAQ is tagged, that no docs section is empty, and that
no FAQ spans two sections.

## 3. Technical API specifications (developer-reference data)

The single source of truth for endpoint-level REST details (method, path,
params, request/response shapes with nested `imp` flags, error scenarios). DRY:
shared elements live once and are composed via resolvers — see
[docs/api-specs.md](api-specs.md) for the full model.

| File | Configures | Edit when |
|------|-----------|-----------|
| [`src/lib/data/api-specs.ts`](../src/lib/data/api-specs.ts) | `API_SPECS` — one entry per REST API (`productId` FK → product). Deltas only | Add/edit an API endpoint |
| [`src/lib/data/api-specs-common.ts`](../src/lib/data/api-specs-common.ts) | `ApiSpec`/`ResponseField`/`ApiParam` types, `COMMON_REQUEST_PARAMS`, response envelopes, resolvers | Change the shared param/response shape or schema |
| [`src/lib/data/api-auth.ts`](../src/lib/data/api-auth.ts) | Auth headers, sandbox/production base URLs, token-generation notes | Auth scheme or environment URLs change |
| [`src/lib/data/api-error-codes.ts`](../src/lib/data/api-error-codes.ts) | Shared HTTP + transaction status-code tables | Error-code reference changes |
| [`src/lib/data/api-spec-previews.ts`](../src/lib/data/api-spec-previews.ts) | Adapters that derive product-page previews + docs links from specs | Change how specs render into page previews |

## 4. Pricing data

| File | Configures | Edit when |
|------|-----------|-----------|
| [`src/lib/data/api-pricing.ts`](../src/lib/data/api-pricing.ts) | Verification per-call rates, tiers, pricing FAQs | Rate-card changes |
| [`src/lib/data/payments-pricing.ts`](../src/lib/data/payments-pricing.ts) | DMT / AePS / BBPS commission slabs, GST/TDS rates | Commission changes |
| [`src/lib/data/connected-banking-pricing.ts`](../src/lib/data/connected-banking-pricing.ts) | Connected-banking (BC) pricing | BC pricing changes |

Pricing feeds the pricing page, `/pricing.md`, and the offline XLSX calculator — see [docs/pricing-calculator.md](pricing-calculator.md).

## 5. Routing & static generation

| File | Configures | Edit when |
|------|-----------|-----------|
| [`src/App.tsx`](../src/App.tsx) | Client routes (`React.lazy`, code-split) | Add/remove a route |
| [`src/AppServer.tsx`](../src/AppServer.tsx) | SSG routes (eager imports) — must mirror `App.tsx` | Add/remove a route |
| [`ssg/routes.ts`](../ssg/routes.ts) | Route manifest — single source of truth for pre-rendered URLs | Add/remove a pre-rendered route |
| [`ssg/plugin.ts`](../ssg/plugin.ts), [`ssg/prerender.ts`](../ssg/prerender.ts), [`ssg/sitemap.ts`](../ssg/sitemap.ts) | SSG pipeline + sitemap generation | Pipeline behaviour changes |

See [docs/static-page-generation.md](static-page-generation.md) and [docs/ssg-hydration.md](ssg-hydration.md).

## 6. Build, TypeScript & tooling

| File | Configures | Edit when |
|------|-----------|-----------|
| [`vite.config.ts`](../vite.config.ts) | Vite build, aliases (`@/`), registered plugins (markdown, xlsx, SSG, image optim) | Build/plugin changes |
| [`vitest.config.ts`](../vitest.config.ts) | Test runner config | Test setup changes |
| [`tsconfig.json`](../tsconfig.json) / [`tsconfig.app.json`](../tsconfig.app.json) / [`tsconfig.node.json`](../tsconfig.node.json) | TypeScript compiler options (app vs node) | Compiler-option changes |
| [`eslint.config.js`](../eslint.config.js) | Lint rules | Lint-rule changes |
| [`components.json`](../components.json) | shadcn/ui generator config | Adding shadcn components |
| [`package.json`](../package.json) | Scripts (`dev`/`build`/`lint`/`test`), dependencies | Deps/scripts |

Tailwind v4 is configured in CSS (no `tailwind.config`); brand tokens (`eko-gold`, `eko-navy`, …) live in the global stylesheet.

## 7. Markdown / AI-agent content generation

| File | Configures | Edit when |
|------|-----------|-----------|
| [`vite-plugin-generate-markdown.ts`](../vite-plugin-generate-markdown.ts) | Build + dev generation of `.md`/`.txt` twins and LLM indexes | Add/serve a new generated file |
| [`vite-plugin-generate-xlsx.ts`](../vite-plugin-generate-xlsx.ts) | Offline pricing-calculator XLSX generation | XLSX output changes |
| [`src/lib/markdown/`](../src/lib/markdown/) | Renderers for product / index / industry / solution / pricing Markdown | Change generated Markdown structure |

See [docs/markdown-generation.md](markdown-generation.md).

## 8. Deployment & hosting

Per-platform redirect/header configs. Each platform reads only its own file; they don't conflict. See README "How can I deploy this project?".

| File | Platform | Configures |
|------|----------|-----------|
| [`vercel.json`](../vercel.json) | Vercel | Rewrites (`/llms-full.txt`→`/index.md`, SPA fallback), `.md`/`.txt` content-type headers, `X-Robots-Tag` on `/console` + `/admin` |
| [`netlify.toml`](../netlify.toml) + [`public/_redirects`](../public/_redirects) | Netlify | Redirects / SPA fallback, `X-Robots-Tag` on `/console` + `/admin` |
| [`.htaccess`](../.htaccess) | Apache | Rewrites / SPA fallback (no `X-Robots-Tag` — not a live target) |
| [`nginx.conf`](../nginx.conf) | Nginx | `.md`/`.txt` MIME types, SPA fallback, `X-Robots-Tag` on `/console` + `/admin` |
| [`public/robots.txt`](../public/robots.txt) | All | Crawler directives |

Internal `/console` and `/admin` routes are blocked from indexing at three
layers — see [static-page-generation.md](static-page-generation.md#sitemap-and-robotstxt).

## 9. Secrets / environment

No secrets are committed. Runtime secrets (if any) come from the deploy
platform's environment variables — never hard-code keys (e.g. Eko `access_key`)
in source. The API auth scheme is documented in [docs/api-specs.md](api-specs.md).

---

### Related detailed docs

- [API Technical Specifications](api-specs.md)
- [Markdown / AI content generation](markdown-generation.md)
- [Pricing page & calculator](pricing-calculator.md)
- [Static page generation (SSG)](static-page-generation.md)
- [SSG hydration rules](ssg-hydration.md)
- [Command palette search](command-palette-search.md)
- [Stale-chunk auto-reload](chunk-error-auto-reload.md)
