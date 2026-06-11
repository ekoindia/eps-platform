# Command Palette Search (⌘K / Ctrl+K)

Global fuzzy search across APIs, industries, solution packs and site pages. Implements item **H9** of [ui-ux-improvement-plan.md](./ui-ux-improvement-plan.md).

## UX

- **Desktop trigger**: search pill in the header CTA area — search icon + "Search" + OS-aware kbd badge (`⌘K` on macOS/iOS, `Ctrl K` elsewhere).
- **Mobile trigger**: icon-only search button next to the hamburger.
- **Keyboard**: `⌘K` / `Ctrl+K` toggles the palette anywhere (ignored while typing in a form field when the palette is closed). `↑↓` navigate, `↵` open, `esc` close.
- **Empty query**: curated "suggested" view (flagship APIs, priority-1 industries/solutions, key pages). Typing searches the full index.
- Results grouped in fixed order: **APIs → Industries → Solutions → Pages**, each row with category icon tile, label and sublabel. Footer shows keyboard hints.
- Selecting a result: SPA navigation (`useNavigate`, no full reload); external items (Developer Docs) open in a new tab; the "Talk to Sales" action dispatches the existing `open-talk-to-sales` window event.

## Architecture

| Concern | Approach |
|---|---|
| Fuzzy engine | `cmdk` built-in scorer (command-score) — no new dependencies. Extra match terms fed via the `CommandItem keywords` prop. |
| Search index | **Auto-generated at module scope** in `src/lib/search-index.ts` from `api-products.ts` (active products only), `api-product-pages.ts` (`seo.keywords`, capped at 12 terms), `industries.ts` / `solutions.ts` (`ACTIVE_*` lists, `priority !== 3`), plus a static pages list. New APIs/industries/solutions appear in search automatically. |
| Lazy loading | `CommandPalette` is a separate Vite chunk, lazy-imported by `Header.tsx` (same pattern as `HeaderDropdownPanels`), mounted on first open, prefetched via `requestIdleCallback`. **Zero initial-bundle impact, zero CLS** — only the fixed-size trigger pill and a keydown listener live in the main bundle. |
| Data weight | The big data modules (`api-product-pages`, `industries`, `solutions`) are already shared Rollup chunks (used by header dropdowns + detail pages), so the palette references them at no extra network cost. Verified: page-data strings appear in exactly one dist chunk. |
| SSG safety | Palette never renders during prerender (`searchMounted` starts `false`); `dist/index.html` contains the trigger pill but no cmdk markup. No `window` access at module scope in the index. |
| OS detection | 1-line inline script in `index.html` sets `<html data-os="mac|other">` before first paint; CSS rules in `src/index.css` show the matching kbd hint (`.kbd-os-mac` / `.kbd-os-other`). No hydration mismatch, no flicker. |
| A11y | Radix Dialog (focus trap, esc, scroll lock) + cmdk combobox semantics; `sr-only` DialogTitle; `aria-keyshortcuts` on the trigger; `motion-reduce:animate-none`. |

## Files

- `src/lib/search-index.ts` — `SearchItem` type + `SEARCH_INDEX` builder (lazy chunk only).
- `src/components/CommandPalette.tsx` — palette UI (Dialog + `ui/command.tsx` primitives).
- `src/components/Header.tsx` — triggers, ⌘K listener, lazy mount + idle prefetch.
- `index.html` / `src/index.css` — OS detection + kbd-hint visibility.

## Maintenance

- **Adding a searchable static page**: append to `buildPageItems()` in `src/lib/search-index.ts`.
- **Curating the empty-query view**: edit `SUGGESTED_API_IDS` (APIs) or rely on `priority: 1` (industries/solutions); set `suggested: true` on page items.
- **Verifying chunk isolation after changes**: `npm run build`, then confirm `dist/assets/CommandPalette-*.js` exists, `grep -c cmdk dist/index.html` → 0, and a long product string (e.g. "domestic money transfer API") appears in only one dist chunk.
