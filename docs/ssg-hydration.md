# SSG pre-rendering & React hydration

How the site keeps pre-rendered HTML and client hydration in sync, and the
rules that prevent React #418/#423 hydration errors (which make React discard
the pre-rendered DOM and re-render from scratch on every page load).

## Pipeline

1. `ssg/prerender.ts` renders every route in `ssg/routes.ts` with
   `renderToString` via `src/entry-server.tsx` → `src/AppServer.tsx`
   (eager page imports — `React.lazy` pages cannot render in `renderToString`).
2. The client (`src/main.tsx`) detects pre-rendered markup and calls
   `hydrateRoot` at browser idle / first interaction. `onRecoverableError`
   logs any hydration mismatch to the console as `[hydration]` warnings with
   component stacks — check this first when debugging.
3. `src/App.tsx` (lazy pages) must produce a **component tree identical** to
   `AppServer.tsx` — including Suspense boundaries (AppServer mirrors App's
   `<Suspense>` around `<Routes>` even though it never suspends server-side).

## Rules (each was a real bug)

- **Never minify the React-rendered subtree.** `minifyAroundRoot()` in
  `ssg/prerender.ts` minifies the document around `#root` but leaves its
  innerHTML byte-for-byte untouched. html-minifier's `removeComments` strips
  React's `<!--$-->` Suspense markers and `<!-- -->` text separators;
  `collapseWhitespace`/`minifyCSS` rewrite text nodes and style attributes —
  any of these breaks hydration.
- **No `React.lazy` under `<Suspense>` during SSR.** Header mounts its lazy
  chunks (dropdown panels, language selector) only after they load
  post-hydration, gated by `lazyChunksReady` state — SSR HTML and first
  client render stay identical, the interactive component swaps in at idle.
- **No nondeterminism in render.** Anything random or time-based must be
  identical between SSG build and client first render. Example:
  `getSolutionPacksForApi` (`src/lib/data/solutions.ts`) rotates packs by a
  hash of `apiId` instead of `Math.random()` shuffle. Defer true randomness
  to `useEffect` + state.

## Verifying

`npm run build && npm run preview`, open a page, wait ~3 s (idle hydration),
console must show zero `[hydration]` warnings. **Use trailing-slash URLs for
prerendered routes** (`/products/foo/`): `vite preview` serves the homepage
HTML for the no-slash form — preview-only artifact (production nginx/Netlify/
Vercel resolve the directory index correctly); spurious mismatches on no-slash
URLs are noise.
