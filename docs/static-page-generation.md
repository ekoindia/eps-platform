## Static Page Generation (SSG) and SPA Fallback

At build time the site pre-renders every known route to a static HTML file.
Each pre-rendered page contains the full React component tree, correct `<head>`
meta tags (title, description, OG, canonical, JSON-LD), and all visible content
— no JavaScript execution required to read it. When a visitor's browser loads
the page, React hydrates the existing HTML into a fully interactive SPA.

If the user navigates from the home page to a product page, React Router handles
the transition client-side (no full reload). If the user opens a product URL
directly or refreshes, the server serves the pre-rendered static HTML
immediately.

### What gets pre-rendered

The route manifest in `ssg/routes.ts` is the single source of truth. It is
built deterministically from the same data modules used to render pages:

```
/                          → home page
/products/:slug            → one file per product slug  (18 routes)
/products/eko-shield
/products/eko-shield/document
/industries                → industries listing
/industries/:slug          → one file per industry slug (17 routes)
/solutions                 → solutions listing
/solutions/:slug           → one file per solution slug (12 routes)
/use-cases
/about-us
/blogs-media
/tnc  /privacy-policy  /refund-policy  /grievance  /signup
```

Total: ~60 routes. Adding a new product, industry, or solution slug to the
data layer automatically adds it to the pre-rendered set on the next build —
no separate configuration needed.

### How it works

#### Build pipeline

```
npm run build
  │
  ├── Vite builds the SPA bundle → dist/
  │     (with .vite/manifest.json)
  │
  ├── generateMarkdownPlugin()   → dist/**/*.md, dist/llms.txt, …
  │
  └── prerenderPlugin()
        ├── Spins up a temporary Vite SSR server
        ├── Loads ssg/routes.ts    (route manifest)
        │         ssg/renderer.ts  (template injection)
        │         src/entry-server.tsx (renderToString + Helmet)
        ├── For each route:
        │     renderPage(url) → { html, head }
        │     inject into dist/index.html template
		│     rewrite /src/assets/* → /assets/* via manifest map
        │     write dist/<route>.html
        ├── Saves original SPA shell as dist/__spa-fallback.html
        └── Generates dist/sitemap.xml
```

#### Client hydration

`src/main.tsx` detects whether the page was pre-rendered by checking for
meaningful markup inside `#root` (ignoring comment-only placeholders like
`<!--ssr-outlet-->`):

```ts
const hasPrerenderedMarkup =
	container.innerHTML.replace(/<!--([\s\S]*?)-->/g, "").trim().length > 0;

if (hasPrerenderedMarkup) {
  hydrateRoot(container, app);   // pre-rendered: attach event handlers only
} else {
  createRoot(container).render(app);  // SPA fallback: full client render
}
```

#### SPA fallback

Routes that are not pre-rendered (e.g. future pages not yet in the manifest)
are caught by the deployment platform's catch-all rule, which serves
`/__spa-fallback.html` — the original Vite-built SPA shell. React Router then
handles the route client-side. This means old URLs never break, and new routes
can be added to the manifest incrementally.

### Key files

| File | Purpose |
|------|---------|
| `ssg/routes.ts` | Deterministic route manifest — add routes here |
| `ssg/renderer.ts` | Injects rendered HTML + Helmet head tags into template |
| `ssg/prerender.ts` | Orchestrator: iterates routes, writes HTML, generates sitemap |
| `ssg/plugin.ts` | Vite plugin (`closeBundle` hook) — registered in `vite.config.ts` |
| `ssg/sitemap.ts` | XML sitemap generator (uses the same route manifest) |
| `src/entry-server.tsx` | SSR entry: `renderPage(url)` via `StaticRouter` + `renderToString` |
| `src/lib/ssr-safe.ts` | Browser-API guards (`safeSessionStorage`, `safeLocationHref`) |
| `vite.config.ts` | Enables `build.manifest` for asset URL rewriting |

### SEO outputs per page

Every pre-rendered page includes:

- `<title>` and `<meta name="description">` from page-level Helmet
- `<meta property="og:*">` Open Graph tags
- `<link rel="canonical">` pointing to `SITE_URL + route` (via `src/lib/config/site.ts`)
- `<link rel="alternate" type="text/markdown">` pointing to the `.md` version
- `<script type="application/ld+json">` structured data where applicable:
  - Industry pages: BreadcrumbList + FAQPage
  - Solution pages: BreadcrumbList + FAQPage + Product
  - Product pages: SoftwareApplication + FAQPage (where data is defined)

All canonical URLs and JSON-LD domain references use the `SITE_URL` constant
from `src/lib/config/site.ts`. Updating that constant propagates everywhere.

### Sitemap and robots.txt

`dist/sitemap.xml` is generated at build time from the route manifest.
`public/robots.txt` references it:

```
Sitemap: https://eps.eko.in/sitemap.xml
```

### SSR-safe compatibility layer

A small number of browser APIs needed guarding before server-side rendering
could work. All fixes live in `src/lib/ssr-safe.ts`:

- **`safeSessionStorage`** — no-ops `sessionStorage` calls during SSR.
  Used in `src/hooks/use-tracking-params.ts` so tracking params are read safely.
- **`isBrowser()`** — explicit browser check used where effects access `window`
	or DOM APIs (for example in `src/components/ZohoSignupForm.tsx`).
- **`safeLocationHref()`** — returns `window.location.href` in the browser,
	`SITE_URL` during SSR. Available for SSR-safe URL reads where needed.

These are the only two SSR-unsafe patterns found in the codebase. Everything
else (`Header`, `LanguageSelector`, `ScrollToTop`, `zoho-form.ts`, etc.) was
already guarded inside `useEffect` or event handlers.

### Tracking params across SSR → hydration

`useCaptureTrackingParams()` runs inside `useEffect`, so it fires after
hydration — correctly capturing `gclid`, `utm_*`, and other tracking params
from the hydrated page URL and persisting them to `sessionStorage`. The
`ZohoSignupForm` iframe starts from a deterministic SSR-safe `SITE_URL` value,
then updates `src` in `useEffect` using `window.location.href` so tracking
params are applied after mount without causing hydration mismatch.

### How to add a new pre-rendered route

1. Add the URL string to the array in `ssg/routes.ts`.
2. Ensure the corresponding React route exists in `src/App.tsx`.
3. Run `npm run build` — the route is pre-rendered automatically.

If the new route is a detail page driven by data (e.g. a new product slug),
adding the slug to the data file is sufficient — the route manifest derives
from the data and picks it up automatically.

### Deployment configuration

Catch-all rewrites now point to `/__spa-fallback.html` instead of `index.html`,
so the pre-rendered `index.html` is served for the home page:

| Platform | Config file | Catch-all target |
|----------|-------------|-----------------|
| Vercel | `vercel.json` | `/__spa-fallback.html` |
| Netlify | `netlify.toml` / `public/_redirects` | `/__spa-fallback.html` |
| Nginx | `nginx.conf` — `try_files $uri $uri.html $uri/` | `/__spa-fallback.html` |

Pre-rendered `.html` files are served as exact static matches before the
catch-all is reached, so there is no routing conflict.

### How to verify SSG output

```sh
# Build and inspect
npm run build

# Check pre-rendered files
ls dist/products/
ls dist/industries/
ls dist/solutions/
cat dist/sitemap.xml

# Serve locally and open a pre-rendered page
npm run preview
open http://localhost:4173/products/aeps-api

# Verify content is server-rendered (disable JS in DevTools — page should still show content)
# Verify no hydration warnings in the browser console
# Verify canonical and JSON-LD in View Source

# Verify asset paths were rewritten (should be 0)
grep -c '/src/assets/' dist/index.html dist/products/dmt-api.html
```


## Future: Migration to Vike

The current SSG implementation is intentionally structured to make a future
migration to [Vike](https://vike.dev) (formerly vite-plugin-ssr) straightforward.

### Why migrate later

The custom SSG plugin handles static pre-rendering well for a fully data-driven
site like this one. However, Vike becomes advantageous when:

- **Incremental rendering** is needed (per-page `+data.ts` hooks)
- **Streaming SSR** is required for faster Time to First Byte on slow connections
- **Partial hydration** or island architecture is wanted to reduce JS bundle size
- **Edge rendering** (Cloudflare Workers, Vercel Edge) is a target environment
- **On-demand SSR** is needed for pages with user-specific or real-time content

### What the migration would look like

The architecture is designed with this transition in mind.

**`src/entry-server.tsx` is the abstraction boundary.** It exports a single
function:

```ts
export function renderPage(url: string): { html: string; head: string }
```

When migrating to Vike:

1. Replace `src/entry-server.tsx` with Vike's `+onRenderHtml.tsx` hook —
   same `renderToString` logic, different export shape.
2. Replace `ssg/plugin.ts` with Vike's built-in pre-rendering (`prerender: true`
   in `+config.ts`).
3. Replace `ssg/routes.ts` with Vike's `+onBeforePrerenderStart.ts` hook that
   returns the same URL list.
4. Keep `src/App.tsx` unchanged — it is router-agnostic (no `BrowserRouter`
   inside it).
5. Replace `src/main.tsx`'s hydration logic with Vike's `+onRenderClient.tsx`.
6. Remove `ssg/` directory entirely.

All page components, data files, Helmet usage, and the `src/lib/ssr-safe.ts`
compatibility layer remain untouched. The migration is isolated to the SSR
entry point and the build plugin.

### Checklist for the migration

- [ ] Install `vike` and `vike-react` (or `vike-react-query`)
- [ ] Create `pages/+config.ts` with `prerender: true` and the route list
- [ ] Move `src/entry-server.tsx` logic to `pages/+onRenderHtml.tsx`
- [ ] Move `src/main.tsx` hydration logic to `pages/+onRenderClient.tsx`
- [ ] Remove `ssg/` directory and `prerenderPlugin()` from `vite.config.ts`
- [ ] Verify `sitemap.xml` is still generated (Vike can call `ssg/sitemap.ts`
  from a post-build script or `+onPrerenderStart` hook)
- [ ] Run `npm run build` and verify all pages pre-render correctly
- [ ] Check for hydration mismatches (none expected — page components are unchanged)
