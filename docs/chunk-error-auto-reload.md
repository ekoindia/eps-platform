# Chunk-load error auto-reload

## Problem

Production intermittently showed a **blank page when clicking an internal link**; a manual reload fixed it.

Root cause chain:

1. Every Vercel deploy replaces all content-hashed chunks; assets are deployment-scoped, so old hashes stop existing.
2. A browser tab holding pre-deploy HTML dynamic-imports an old chunk URL on first navigation to a not-yet-loaded route (all routes are `React.lazy()` in `src/App.tsx`).
3. The SPA rewrite (`vercel.json`) caught the missing asset URL and returned **HTTP 200 with HTML** (`__spa-fallback.html`), so the browser rejected the module with a MIME-type error.
4. `React.lazy` threw, there was no error boundary, and `<Suspense fallback={null}>` meant React unmounted the tree → blank page.

It happened exactly when a deploy landed between page load and the first click on an unvisited route — hence "after the tab sat idle" and "first click after load" both fit.

## Fix

Three layers:

1. **`src/lib/reload-on-chunk-error.ts`** — `installChunkErrorReload()` (called in `src/main.tsx`) listens for Vite's `vite:preloadError` window event and reloads the page so the browser fetches fresh HTML with current chunk hashes. `reloadOnceForStaleChunk()` guards via a `sessionStorage` timestamp (`chunk-reload-at`): at most one forced reload per 30 s, so a genuinely broken deploy cannot cause an infinite reload loop.
2. **`src/components/ErrorBoundary.tsx`** — wraps the routes in `src/App.tsx`. Chunk-load errors (detected by `isChunkLoadError()` message matching) trigger the same guarded reload; all other render errors show a "Something went wrong / Reload page" UI instead of a blank page.
3. **Hosting configs** (`vercel.json`, `netlify.toml`, `nginx.conf`) — `/assets/*` is excluded from the SPA-shell rewrite so missing chunks fail fast with a 404 instead of 200+HTML, and hashed assets get `Cache-Control: public, max-age=31536000, immutable`.

## Behavior summary

| Scenario | Result |
|---|---|
| Stale chunk on navigation (post-deploy) | Silent reload once → user lands on the clicked page |
| Chunk still failing within 30 s of a forced reload | Error UI with Reload button (no loop) |
| Any other render-phase error | Error UI with Reload button (previously: blank page) |

## Verifying locally

```sh
npm run build && npx vite preview --port 4173
```

Load a page, delete a route chunk from `dist/assets/` (e.g. `AboutPage-*.js`), click its nav link: the page should auto-reload and render the route. Delete it again right after: the error UI should appear instead of a reload loop.
