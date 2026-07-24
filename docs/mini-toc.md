# Mini table-of-contents (`MiniToc`)

A Medium-style mini table-of-contents: a fixed vertical strip of tiny dashes
(one per heading), vertically centered on the right, that expands into a
clickable heading list on hover or keyboard focus and tracks the current
section as you scroll. Large screens only (`lg:`+); hidden on mobile.

Source: `src/components/MiniToc.tsx`.

## How it works

- **Runtime scan (no id retrofitting).** On mount it runs
  `document.querySelector(scopeSelector)` and scans it for
  `h1, h2, h3, [data-toc]`, building `{ el, text, level }` entries. The page H1
  is always excluded — it's the page title, not a section. It holds
  element refs and scrolls to them directly, so no anchor ids or URL hashes are
  created. A `MutationObserver` on the scope re-scans when content changes (MDX
  compile / route swap under a persistent layout).
- **Headingless anchors.** Content with no heading (the API-reference
  "Description" block) opts in with `data-toc="Label"` and optional
  `data-toc-level="2"`; the attribute value becomes the label.
- **Placement.** `position: fixed`, `top: 50%`. `align="viewport"` (default)
  pins it 8px inside the window's right edge (`documentElement.clientWidth`, so
  a classic scrollbar is excluded) — the Medium look for wide marketing pages.
  `align="container"` pins it 8px inside the right edge of the scanned box's
  enclosing `<main>` pane, used by docs API pages where the code-samples
  `docs-rightpane` owns the true right edge. The x is clamped so it never runs
  off-screen near the breakpoint.
- **Scroll-spy.** A rAF-throttled scroll listener sets the active entry to the
  last heading whose top has passed the ~96px header offset.
- **Scrolling.** Clicks call `window.scrollTo` with the header offset (headings
  have no `scroll-mt` site-wide), honoring `prefers-reduced-motion`.
- **Suppressed** when fewer than 2 entries are found (renders `null`), which is
  also why it is SSR/hydration-safe: server render and first client render both
  produce nothing until the post-mount scan populates entries.

## Props

| Prop | Default | Meaning |
| --- | --- | --- |
| `maxLevel` | `3` | `2` = H2 only (marketing pages, avoids card-title H3 noise); `3` = H2–H3 (docs/article structure). H1 is never listed. |
| `scopeSelector` | `"main"` | Element to scan (and to measure when `align="container"`). |
| `align` | `"viewport"` | `"viewport"` or `"container"` — see Placement above. |

## Where it's mounted

Rendered inside each page's themed root so Tailwind `dark:` variants inherit the
correct theme (marketing = next-themes `.dark` on `<html>`; docs = `DocsLayout`'s
local `.dark` subtree):

- Marketing: `ProductPageLayout`, `IndustryPageLayout`, `SolutionPageLayout` —
  `maxLevel={2}`.
- AI tools / about: `AiPage`, `AgentsPage`, `AboutPage` — `maxLevel={2}`.
- Docs (guides + API reference): `DocsLayout` — `maxLevel={3}
  scopeSelector="[data-toc-anchor]"` with `data-toc-anchor` on the middle
  `max-w-3xl` content box. `align` is `"container"` only when a right pane
  exists (endpoint pages — the code-samples pane owns the true right edge);
  guides pin to the viewport edge. The API-reference "Description" is marked
  with `data-toc` in `EndpointDetail.tsx`.

## Tests

`src/test/mini-toc.test.tsx` covers the scan: level mapping, the `maxLevel`
cutoff, `[data-toc]` anchors, and the < 2-heading suppression.
