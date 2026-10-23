# Kiosk learnings: backport plan

The eko-kiosk-website technical SEO plan (`eko-kiosk-website/docs/seo/`, Oct 2026) started from this repo's website: SSG, `.md` twins, `PageMeta`, JSON-LD, chunk reload. Along the way it added a number of improvements that this site doesn't have yet. This doc lists the ones that would clearly benefit eps-platform. Each item has a checklist and acceptance criteria.

Scope: the root Vite website only (`src/`, `ssg/`, `public/`, `index.html`, host configs). `packages/*` is not affected.

Items are ranked by benefit. Each one can ship as its own PR, except that **0 must come first**.

---

## 0. Preflight: move `vercel.json` off the legacy `routes` key

**Production host is settled: Vercel.** On 2026-10-19, `https://eps.eko.in` answered with `server: Vercel` and `x-vercel-id`, and the `.md` headers from `vercel.json` were live. So the mixed config deploys today. Vercel's docs still say `routes` can't be combined with `redirects`, `rewrites`, `headers`, `cleanUrls` or `trailingSlash`, which makes this a forward-compatibility fix, not a blocker. Items 3, 5, 8, 11 and 12 don't have to wait for it. Item 4 shipped without it.

- [x] Find out which host serves `https://eps.eko.in` in production. It is Vercel; recorded in `docs/configuration.md`.
- [ ] Check whether `/api/*` actually reaches eps-backend in production. On 2026-10-19, `https://eps.eko.in/api/health` returned 404. That may just mean the backend has no `/health` route; confirm with a known route such as `/api/me`.
- [ ] Replace the `routes` entry with a `rewrites` entry:
  ```json
  { "source": "/api/:path*", "destination": "https://<backend-origin>/:path*" }
  ```
  `rewrites` don't support `${ENV}` interpolation. If the origin must differ per environment, use one rewrite per Vercel environment, or keep the API proxy on the backend host.
- [ ] Every hosting change below must be mirrored in each host file that is live or supported: `vercel.json`, `netlify.toml` plus `public/_redirects`, `nginx.conf`, and `.htaccess`. This is the repo's existing convention (see `docs/configuration.md`).

**Accept:**
- `vercel build` (or `vercel deploy --prebuilt` on a preview) succeeds with no "mixed routing properties" error.
- `/api/*` still reaches eps-backend on a preview.
- `docs/configuration.md` names the production host.

---

## High benefit

### 1. Real 404 status instead of the SPA fallback

Unknown URLs are rewritten to `/__spa-fallback.html` with HTTP 200, so every mistyped or removed slug is a soft 404. With hundreds of pre-rendered routes and a growing list of slug renames, this wastes crawl budget and shows up as "Soft 404" in Search Console. The `noindex` meta in `NotFound.tsx` only helps crawlers that run JavaScript.

Only `/console/*` and `/admin` actually need the SPA fallback; they are client-only and not pre-rendered. Every public route is in `PRERENDER_ROUTES`.

- [ ] In `ssg/prerender.ts`, also render the catch-all `NotFound` route to `dist/404.html`. It keeps its `noindex` meta and its context-aware copy, which comes from the client-side path after hydration.
- [ ] Narrow the fallback rewrite from `/((?!assets/|\.well-known/|ai-sitemap\.xml$).*)` to the client-only areas:
  ```json
  { "source": "/console", "destination": "/__spa-fallback.html" },
  { "source": "/console/:path*", "destination": "/__spa-fallback.html" },
  { "source": "/admin", "destination": "/__spa-fallback.html" },
  { "source": "/admin/:path*", "destination": "/__spa-fallback.html" }
  ```
  Vercel then serves `404.html` with status 404 for anything unmatched. This also covers `/assets/*`, `/.well-known/*` and `/ai-sitemap.xml`, so their special-case exclusions can go.
- [ ] Mirror it:
  - `netlify.toml` / `_redirects`: scoped `200` rewrites plus `404.html`, which Netlify serves automatically;
  - `nginx.conf`: `try_files $uri $uri/index.html =404` plus `error_page 404 /404.html`, with `location /console` and `location /admin` falling back to `/__spa-fallback.html`;
  - `.htaccess`: the equivalent.
- [ ] The routes that currently use a client-side `<Navigate replace>` (`/blog`, `/press`) can't rely on the fallback any more. Move them to host-level 301s in `redirects`, next to the existing slug renames.
- [ ] Add a route-coverage test, e.g. `src/test/routes-coverage.test.ts`:
  - every concrete public `path` in `src/AppServer.tsx` is in `PRERENDER_ROUTES` or in an explicit `CLIENT_ONLY_PREFIXES = ["/console", "/admin"]` list;
  - every dynamic `:slug` route has its slugs enumerated from the data layer, as today.

  With no catch-all, a new public route that someone forgets to pre-render would otherwise 404.

**Accept:**
- `curl -sI https://<preview>/products/does-not-exist` → `404`, and the body contains `noindex`.
- `curl -sI https://<preview>/console/credentials` → `200`, and the console works after login.
- `curl -sI https://<preview>/blog` → `301`.
- `curl -sI https://<preview>/assets/nope.js` → `404`. The chunk-reload behaviour in `docs/chunk-error-auto-reload.md` still works.
- Search Console's Soft 404 count trends to zero within a few weeks.

### 2. Security headers plus a Report-Only CSP

No security headers are set anywhere. eps-platform has more at stake than a typical marketing site:

- the `/docs` "Test Request" dialog does HMAC signing in the browser (`src/lib/uat-credentials.ts`);
- `/console` is an authenticated area handling credentials, KYC documents and payments.

Clickjacking and XSS mitigations matter here.

- [ ] Add a global header block to every live host config:
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains`. Leave out `preload`; it must be submitted for the apex `eko.in`, which is an Eko-wide decision.
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(), usb=()`. **Check first:** if console KYC uses the camera, scope that path to `camera=(self)`.
  - `X-Frame-Options: DENY` plus `Content-Security-Policy: frame-ancestors 'none'`. Enforce this from day one; `frame-ancestors` is **ignored inside Report-Only**.
  - `Reporting-Endpoints: csp="<report URL>"`
  - `Content-Security-Policy-Report-Only: …`, covering:
    - self;
    - GTM, GA4 and Google Ads domains;
    - Zoho SalesIQ (`salesiq.zohopublic.in`, `*.zohocdn.com`, plus the chat websocket);
    - the Zoho signup iframe (`frame-src`);
    - Google Fonts (until item 14);
    - eps-backend (`connect-src`, for `/tryit/proxy` and the console APIs);
    - the payment gateway domains used by `PayActivationFee`.

    Use `'unsafe-inline'` for scripts to start with, because GTM injects inline code; tighten it with nonces later.
- [ ] Report endpoint: CSP reports must not be proxied into eps-backend by accident. Either add a small `POST /csp-report` handler to eps-backend that logs one compact line per violation and returns 204, or use a Vercel function if Vercel is the host. Cap the body size and store no PII.
- [ ] After 2–4 weeks with no legitimate violations, switch to the enforced `Content-Security-Policy`. Add a rule to `docs/configuration.md`: any new GTM tag or third-party domain must be added to the CSP in the same PR.

**Accept:**
- securityheaders.com grades `eps.eko.in` A or better.
- The console works end to end: login, credentials, test APIs, KYC, pay activation fee, transactions.
- The `/docs` Test Request dialog works, and so do SalesIQ chat and `/signup`.
- A test violation (an inline `<img src="https://example.com/x.png">` injected from DevTools) appears in the report log.

### 3. A real `llms-full.txt`

`/llms-full.txt` is a rewrite to `/index.md`, which is a **link index**, not full content. `docs/agent-readiness-review.md` already lists this as open (Phase 5.3). For an API platform this is the most useful single file an agent can fetch: every product page, recipe, error code and doc in one request, with no crawl.

- [ ] In `vite-plugin-generate-markdown.ts` (`closeBundle`), after all twins are written, concatenate them into `dist/llms-full.txt`:
  - in a deterministic order (products → recipes → docs/API reference → industries/solutions → FAQ/security/pricing);
  - with front-matter stripped;
  - each twin preceded by `# <title>` and `Source: <canonical URL>`.
- [ ] Exclude anything that is noindex or private, such as `/samples/partner-agreement` and anything under `/console` or `/admin`.
- [ ] Put a size note in the header line (e.g. `> ~N tokens`) so agents can decide whether to fetch it.
- [ ] Remove the `/llms-full.txt` → `/index.md` rewrite from every host config. Add `llms-full.txt` to the `text/plain` header rule.
- [ ] Update `renderLlmsTxt` (`src/lib/markdown/render-index.ts`) to link `/llms-full.txt` under `## Optional`.
- [ ] Test: `llms-full.txt` contains every indexable twin's canonical URL exactly once, and no `noindex` page.

**Accept:**
- `curl -s https://eps.eko.in/llms-full.txt | grep -c '^Source: '` equals the number of indexable twins.
- `docs/agent-readiness-review.md` Phase 5.3 is marked done.

### 4. A canonical header on every `.md` twin ✅ (2026-10-19)

**Done:**
- Vercel: a pattern rule with `:path` interpolation, plus an exact `/index.md` rule.
- nginx: a named regex capture.
- Netlify: skipped, because it can't interpolate a path into a header value; see `docs/markdown-generation.md`.
- `src/lib/vercel-config.test.ts` guards the mapping.
- Verified on prod 2026-10-22. `/products/aeps-api.md`, `/index.md` (→ `/`), `/docs.md`, `/docs/sdk/python.md`, `/docs/how-auth-works.md` and `/recipe/bbps-bill-payment.md` all carry the right canonical. `/samples/partner-agreement.md` keeps `X-Robots-Tag: noindex`. HTML pages get no canonical `Link`. Vercel does fill `:path` into header values.


Every product, recipe, doc, SDK and industry page has a `.md` twin with the same content as its HTML page. Search engines can index the twins as duplicates and split ranking signals. A canonical `Link` HTTP header on each twin, pointing at its HTML page, fixes this without hiding the twins from agents.

- [x] Choose how to emit the header per twin: chose (b) on Vercel and nginx.
  - **(a) Per-twin header rules generated at build time.** In `vite-plugin-generate-markdown.ts`, write a generated `_headers` file for Netlify and an nginx include file. For Vercel, generate the `headers` entries into the output config, or use a `vercel.json` build step.
  - **(b) A single pattern rule wherever the host supports capture groups:**
    ```json
    { "source": "/:path*.md", "headers": [{ "key": "Link", "value": "<https://eps.eko.in/:path*>; rel=\"canonical\"" }] }
    ```
    Watch the special cases: `/index.md` → `/`, and the directory-index twins.

  Prefer (b) where it works and fall back to (a).
- [x] Twins that are hand-authored and served raw (`/samples/partner-agreement.md`) keep their `X-Robots-Tag: noindex`.

**Accept:**
- `curl -sI https://eps.eko.in/products/aeps-api.md | grep -i '^link:'` shows `rel="canonical"` pointing to `https://eps.eko.in/products/aeps-api`.
- `/index.md` points to `https://eps.eko.in/`.
- Spot-check five twins from different sections.

### 4b. Human page URLs in context-MCP results ✅ (2026-10-19)

Not from kiosk. It is the agent-side counterpart of item 4. An agent answering from `eps-context-mcp` should tell the user which page to read.

- [x] The bundle gains `pages`: absolute URLs per product (only products with a page), recipe and topic. Like `sdks` and `faqs`, it is excluded from `bundleVersion`, so URL edits never republish the SDKs.
- [x] `list_apis`, `search` and `get_api` return `docsUrl`, plus `productUrl` where the product has a page.
- [x] `list_recipes`/`get_recipe`, `get_topic` and `get_faqs` return `docsUrl`; `get_meta` returns `siteUrl`.
- [x] The server's MCP `instructions` tell agents to pass the URLs on.
- [x] The hosted `/context` server and the docs-chat tools share `bundle-access.ts`, so both get the URLs.
- [x] Deploy, verified 2026-10-22:
  - The site serves `/agent/eps.json` with `pages` (23 products).
  - The hosted `/context` server returns `docsUrl`, `productUrl` and `siteUrl`.
  - `@ekoindia/eps-context-mcp@0.1.39` is published.
  - `bundleVersion` is unchanged by the change (`4a281cb2`).

**Accept:** `POST https://mcp.eko.in/context/tools/list_apis` entries include `docsUrl`, and AEPS entries include `productUrl: https://eps.eko.in/products/aeps-api`.

---

## Medium benefit

### 5. Keep non-production hosts out of the index

There is no host-based noindex, so Vercel or Netlify preview URLs and any `*.vercel.app` alias can be indexed as duplicates of `eps.eko.in`.

- [ ] Vercel: add
  ```json
  { "source": "/(.*)", "missing": [{ "type": "host", "value": "eps.eko.in" }], "headers": [{ "key": "X-Robots-Tag", "value": "noindex, nofollow" }] }
  ```
- [ ] Netlify: use a context-specific header in `netlify.toml` (`[context.deploy-preview]`, `[context.branch-deploy]`).
- [ ] nginx and Apache serve only production, so nothing is needed there.
- [ ] In the host dashboard, 301 the production `*.vercel.app` / `*.netlify.app` alias to `eps.eko.in`. Don't redirect preview URLs.

**Accept:**
- `curl -sI https://<preview-url>/` includes `x-robots-tag: noindex`.
- `curl -sI https://eps.eko.in/` doesn't.

### 6. Load GTM only on the production host

GTM (`GTM-MLL3LZZD`) loads on every host. Preview and local traffic pollutes GA4, including `palette_search` telemetry.

- [ ] In `index.html`, wrap the GTM snippet and its `<noscript>` iframe:
  ```js
  if (location.hostname === "eps.eko.in" || location.search.includes("gtm_debug")) { /* GTM snippet */ }
  ```
  GTM Preview / Tag Assistant still works on any host, because it appends `gtm_debug`.
- [ ] `pushDataLayer` (`src/lib/analytics.ts`) is already a no-op when `dataLayer` is absent. Verify nothing else assumes GTM has loaded.

**Accept:**
- No `gtm.js` request on a preview URL.
- `gtm.js` is requested on `eps.eko.in`.
- Tag Assistant connects to a preview URL.

### 7. Consent Mode v2 plumbing (defaults granted)

Currently there are no consent signals. India's DPDP Rules phase in consent obligations around May 2027. Wiring Consent Mode now means a future consent banner is a configuration change, not a retrofit of every tag.

- [ ] In `index.html`, add an inline script **before** the GTM snippet:
  ```js
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('consent', 'default', {
    ad_storage: 'granted', ad_user_data: 'granted',
    ad_personalization: 'granted', analytics_storage: 'granted'
  });
  ```
  Comment it with how to flip it: set the defaults to `denied` and have a banner call `gtag('consent','update', …)`.
- [ ] In the GTM container, set every Google tag to built-in consent checks, and gate non-Google tags on `ad_storage` / `analytics_storage`.
- [ ] Record the defaults and the flip procedure in `docs/features/palette-telemetry.md`, or in a new `docs/analytics.md`.

**Accept:**
- In Tag Assistant, the consent state shows "granted" for all four signals **before** any tag fires.
- GA4 data volume is unchanged after deploy.

### 8. Explicit trailing-slash policy

No `trailingSlash` setting exists, so `/products/aeps-api` and `/products/aeps-api/` can both resolve and compete with the canonical. `docs/static-page-generation.md` already records the `vite preview` trailing-slash gotcha.

- [ ] After item 0, set `"trailingSlash": false` in `vercel.json`. Mirror it:
  - Netlify: Pretty URLs, plus a redirect rule `/*/  /:splat  301`;
  - nginx: `rewrite ^/(.+)/$ /$1 permanent;`, excluding real directories you serve.
- [ ] Confirm that every canonical URL emitted by `PageMeta` and `ssg/sitemap.ts` has no trailing slash. They should already, since they come from `SITE_URL + route`.

**Accept:**
- `curl -sI https://eps.eko.in/pricing/` → `308`/`301` to `/pricing`.
- The sitemap URLs and canonicals all have no trailing slash.

### 9. Home page JSON-LD with `WebSite` and `Organization`

The home page has no JSON-LD, and no page has a `WebSite` node. The home page is where knowledge-panel and sitelinks signals come from.

- [ ] In `src/lib/utils/json-ld.ts`, add:
  - a `websiteNode()`: `@id: SITE_URL + "/#website"`, `url`, `name: "Eko Platform Services"`, `publisher: { "@id": "…#organization" }`, `inLanguage: "en-IN"`.
    - Add a `SearchAction` **only** if a URL-addressable search exists. Today the ⌘K palette is client-only, so leave it out unless a `/search?q=` route is added.
  - a `generateHomeJsonLd()` that returns `@graph: [organizationNode(), websiteNode()]`.
- [ ] Render it from `src/pages/Index.tsx` through the existing Helmet pattern.
- [ ] Extend `src/lib/utils/json-ld.test.ts` to check that the home graph has both nodes, `@id` references resolve, and there is no `foundingDate` on the EPS node (it belongs to `parentOrganization`, as today).

**Accept:**
- Google Rich Results Test and validator.schema.org show 0 errors on `/`.
- Organization and WebSite are detected.

### 10. Lighthouse CI on PRs (warn-only first)

`ci.yml` builds and tests but has no performance or SEO budget. Regressions in LCP or CLS, such as a hero image losing `fetchPriority` or a font change, go unnoticed until field data drops weeks later.

- [ ] Add a job to `.github/workflows/ci.yml`, or a separate `lighthouse.yml`, that runs after the build: `npx @lhci/cli@<pinned> autorun`. This adds no package dependency.
- [ ] `lighthouserc.json`:
  - `staticDistDir: "./dist"`, mobile preset, `numberOfRuns: 3`;
  - URLs: `/`, `/pricing/`, one product page, one `/docs/<slug>/` page. Use trailing slashes, because of the local static-server directory-index behaviour.
  - Warn-only assertions: `categories:seo` = 1, `categories:accessibility` ≥ 0.9, LCP ≤ 2500 ms, CLS ≤ 0.1, TBT ≤ 200 ms.
  - Upload with `target: "filesystem"` plus `actions/upload-artifact`, not public temporary storage.
- [ ] After one month, change the SEO, LCP and CLS assertions to `error`, with thresholds just below the observed medians.

**Accept:**
- A PR shows the Lighthouse job with a report artifact.
- A PR that deliberately removes `fetchPriority="high"` from a product hero shows an LCP warning.

---

## Low benefit (cheap)

### 11. Start hydration on pointer-down

`src/main.tsx` triggers hydration on `click`, `touchstart`, `keydown` and `scroll`. React replays a click that arrives *while* hydration is in progress, but not the click that *started* hydration, because `hydrateRoot` is called from inside that click's listener. On desktop, the first click on a not-yet-hydrated page (header dropdown, ⌘K button, tabs) is silently lost. Touch devices are fine, because `touchstart` comes before `click`.

- [ ] Add `pointerdown` and `mousedown` to `TRIGGER_EVENTS`, ahead of `click`. Hydration then starts on press, and the click lands during hydration and is replayed.

**Accept:**
1. Throttle the CPU 6× in DevTools.
2. Reload a docs page.
3. Within one second, click a header dropdown with the mouse.

It opens on the first click.

### 12. Explicit AI crawler groups and `Content-Signal` in robots.txt

`public/robots.txt` has only `User-agent: *`. AI bots are allowed implicitly, but the policy isn't stated, and the training and retrieval signals are absent.

- [ ] Add one group listing the named bots. A bot that matches a named group ignores `*`, so the group must repeat the same `Disallow` lines (`/console`, `/admin`):
  - `GPTBot`, `OAI-SearchBot`, `ChatGPT-User`
  - `ClaudeBot`, `Claude-SearchBot`, `Claude-User`
  - `PerplexityBot`, `Perplexity-User`
  - `Google-Extended`, `Applebot-Extended`, `CCBot`, `meta-externalagent`, `Amazonbot`, `DuckAssistBot`, `MistralAI-User`
- [ ] Add `Content-Signal: search=yes, ai-input=yes, ai-train=yes` to both groups. **Confirm the policy first:** this states that EPS content may be used for AI training. That suits a developer platform that wants agents to know its APIs, but it is a business decision.

**Accept:** the Search Console robots.txt report shows no errors, and `/console` and `/admin` are still disallowed for every group.

### 13. A `Link` alternate header for `.md` twins ✅ (2026-10-22)

Moved up from low priority, because it reuses item 4's mechanism.

**Done:**
- Vercel: per-section rules, not a catch-all, so no route advertises a twin that doesn't exist.
- nginx: a `map $request_uri`.
- Tests: `vercel-config.test.ts`.
- Build guard: the build fails on any advertised twin that is missing. On 2026-10-22, 160 of 169 prerendered routes advertised a twin and none were missing.
- Details are in `docs/markdown-generation.md`.
- Still to do:
  - run the Accept curl on prod after deploy;
  - `nginx -t` hasn't been run, because no nginx was available locally.


Agents can discover twins today only by parsing the HTML `<link rel="alternate" type="text/markdown">`. An HTTP `Link` header makes this discoverable from a `HEAD` request.

- [x] Use the same mechanism as item 4, in the reverse direction. On each HTML route, send:
  ```
  Link: </products/aeps-api.md>; rel="alternate"; type="text/markdown"
  ```
  This is either a pattern rule (`/:path*` → `</:path*.md>`, with `/` → `/index.md` special-cased) or rules generated from `PRERENDER_ROUTES`.
- [x] Skip noindex and private routes.

**Accept:** `curl -sI https://eps.eko.in/pricing | grep -i '^link:'` shows the `.md` alternate.

### 14. Self-hosted Inter font

Inter currently loads from Google Fonts. It is already non-blocking (`media="print"` swap), but it adds two third-party origins: an extra DNS/TLS round-trip, and CSP allowances for item 2.

- [ ] Download the Inter variable woff2 (latin subset) into `public/fonts/` and declare `@font-face` in `src/index.css` with `font-display: swap`. This is a one-off download, not an npm package.
- [ ] Preload the single woff2 in `index.html` (`<link rel="preload" as="font" type="font/woff2" crossorigin>`).
- [ ] Remove the Google Fonts `<link>`s, the `preconnect`s and the `<noscript>` fallback. Remove `fonts.googleapis.com` and `fonts.gstatic.com` from the CSP.
- [ ] Add `/fonts/(.*)` → `Cache-Control: public, max-age=31536000, immutable` with a versioned filename.

**Accept:**
- No requests to `fonts.googleapis.com` or `fonts.gstatic.com`.
- Text renders identically.
- Lighthouse LCP and CLS on `/` don't get worse.

---

## Not backported

These kiosk items don't fit eps-platform:

- `hreflang` and vernacular URLs: the audience is English-speaking developers.
- The one-off manual image conversion: eps already has a better `vite-imagetools` pipeline.
- HTML → Markdown conversion with turndown: eps's data-layer renderers are the better source of truth here.
- First-touch attribution changes: `use-tracking-params.ts` already does more than kiosk's version.
- `Accept: text/markdown` content negotiation: kiosk rejected it because on Vercel it needs Routing Middleware on every page view.

## Docs to update when shipping

- `docs/configuration.md`: production host (item 0 ✅), security headers and CSP rules (2), trailing-slash policy (8).
- `docs/static-page-generation.md`: `404.html` and the scoped fallback (1), Lighthouse budget (10), hydration triggers (11).
- `docs/markdown-generation.md`: `llms-full.txt` (3), twin `Link` headers (4 ✅, 13 ✅).
- `docs/agent-readiness-review.md`: mark Phase 5.3 done (3).
- `README.md` "Gotchas": the SPA-fallback sentence changes after item 1.
