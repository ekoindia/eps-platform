# Command Palette Search (⌘K / Ctrl+K)

Global fuzzy search across APIs, industries, solution packs and site pages. Implements item **H9** of [ui-ux-improvement-plan.md](./ui-ux-improvement-plan.md).

## UX

- **Desktop trigger**: search pill in the header CTA area — search icon + "Search" + OS-aware kbd badge (`⌘K` on macOS/iOS, `Ctrl K` elsewhere).
- **Mobile trigger**: icon-only search button next to the hamburger.
- **Keyboard**: `⌘K` / `Ctrl+K` toggles the palette anywhere (ignored while typing in a form field when the palette is closed). `↑↓` navigate, `↵` open, `esc` close.
- **Empty query**: curated "suggested" view (flagship APIs, priority-1 industries/solutions, key pages), grouped in fixed order: **APIs → Guides → Industries → Solutions → Pages**.
- **Typing**: a flat, globally-ranked list — grouping would fight the ranking. Each row has a category icon tile, label, sublabel and a type badge (endpoints show an HTTP method pill and their request path instead).
- **Scope tabs** narrow to one asset type. Leading prefix tokens jump straight to a scope and are consumed from the input: `e: upi`, `g: auth`, `api:`, `sol:`, `ind:`, `page:`, `faq:`.
- Selecting a result: SPA navigation (`useNavigate`, no full reload); external items (Developer Docs) open in a new tab; the "Talk to Sales" action dispatches the existing `open-talk-to-sales` window event.

## Architecture

| Concern | Approach |
|---|---|
| Search engine | **MiniSearch** (`minisearch@^7`, ~5 KB gz) in `src/lib/search-engine.ts` — BM25 with prefix matching, length-gated fuzzy, and per-field boosts. `cmdk` is left to do rendering and keyboard navigation only (`shouldFilter={false}`); it no longer scores anything. |
| Search index | **Auto-generated at module scope** in `src/lib/search-index.ts` from `api-products.ts` (active products with a page), `api-product-pages.ts` (`seo.keywords`, capped at 12 terms), `docs-registry.ts` (endpoints + guides), `industries.ts` / `solutions.ts` (`ACTIVE_*` lists, `priority !== 3`), `common-faqs.ts`, plus a static pages list. New APIs/endpoints/industries/solutions appear in search automatically. |
| Body index | `dist/search-body.json` — long-form page prose, keyed by `SearchItem.id`. Emitted by `vite-plugin-generate-markdown.ts` from the same renderers that produce the `.md` twins, so there is no second source of truth. **Lazily fetched when the palette first mounts**, then the MiniSearch index is rebuilt with a `body` field. 157 entries / ~160 KB (~38 KB gz), entirely off the critical path; a 404 or offline just leaves the label-only index in place. |
| Lazy loading | `CommandPalette` is a separate Vite chunk, lazy-imported by `Header.tsx` (same pattern as `HeaderDropdownPanels`), mounted on first open, prefetched via `requestIdleCallback`. **Zero initial-bundle impact, zero CLS** — only the fixed-size trigger pill and a keydown listener live in the main bundle. |
| Data weight | The big data modules (`api-product-pages`, `industries`, `solutions`) are already shared Rollup chunks (used by header dropdowns + detail pages), so the palette references them at no extra network cost. Verified: page-data strings appear in exactly one dist chunk. |
| SSG safety | Palette never renders during prerender (`searchMounted` starts `false`); `dist/index.html` contains the trigger pill but no cmdk markup. No `window` access at module scope in the index. |
| OS detection | 1-line inline script in `index.html` sets `<html data-os="mac|other">` before first paint; CSS rules in `src/index.css` show the matching kbd hint (`.kbd-os-mac` / `.kbd-os-other`). No hydration mismatch, no flicker. |
| A11y | Radix Dialog (focus trap, esc, scroll lock) + cmdk combobox semantics; `sr-only` DialogTitle; `aria-keyshortcuts` on the trigger; `motion-reduce:animate-none`. |

## Ranking

Score = BM25 over the boosted fields × an asset-type multiplier.

| Knob | Value | Why |
|---|---|---|
| Field boosts | `slug: 8`, `label: 3`, `keywords: 1.5`, `sublabel: 1` | Slug is the strongest identity signal: short, unique, and URL-stable. Labels are marketing prose of variable length, and BM25 penalises long fields — at `slug: 4` the query "bbps" ranked `api:bbps-api` *seventh*, behind six of its own endpoints, because the label "Bharat Bill Payment System (BBPS)" dilutes the term across five tokens while "Pay BBPS Bill" concentrates it in three. |
| `TYPE_ALPHA` | `1.5` (multiplier spans 1.0–2.5) | Delivers what `TYPE_WEIGHT` promises — *"higher = surfaced first on equal text relevance"*. The previous 0.5 was too weak to overcome BM25 spread between sibling documents. |
| `combineWith` | `"AND"`, with an OR fallback | Every meaningful query term must match. Requires the stopword list to be correct — see below. |
| `OR_SCORE_FLOOR` | `0.2` | Trims the fallback's noise tail — see below. |
| `MAX_RESULTS` | `50` | Body indexing widened recall a lot ("pricing" matches 102 documents). Nobody scrolls a palette that far, and each result is a DOM node rebuilt per keystroke. Applied *after* scope filtering. |

### The descriptive-query fallback

Under `AND`, a single word no document uses zeroes the entire query — and sentence-shaped queries are full of such words. Measured on 12 natural-language queries, **7 returned nothing**: *"confirm a company actually exists"*, *"make sure a driver is licensed"*, *"let shopkeepers withdraw cash for customers"* and so on.

When the strict pass returns **zero** results, the query is retried with `combineWith: "OR"`, keeping only results scoring at least `OR_SCORE_FLOOR` of the best. Unfiltered OR returns 30–100 items for these queries, almost all noise; the score curve drops off a cliff after the genuine matches, so the floor cuts them to 1–9.

This recovers 6 of the 8 previously-dead queries with the right answer in the top 3. Two remain unanswerable lexically (*"check if someone is who they say they are"*, *"stop fraudulent payouts"*) — they share no vocabulary with any document, and would need semantic retrieval.

The fallback fires **only on a total miss**, so a query that already matched precisely is never diluted, and gibberish still returns nothing.
| `fuzzy` | length-gated: off < 4 chars, `0.15` at 4, `0.2` at 5+ | At 3 characters an edit distance of 1 makes "pan" match "pin", "can" and "ban". |

**Stopwords are load-bearing.** With `combineWith: "AND"`, a query like *"how do I verify a bank account"* is unanswerable unless `how`/`do`/`i`/`a` are dropped — no document contains them. They are stripped from both the index and the query.

**Synonyms** are canonicalised on *both* sides (index and query) rather than expanded at index time; expansion inflates term frequency for documents that naturally contain several aliases. Two rules, both guarded by tests in `search-engine.test.ts`:

1. **Only alias spellings absent from the corpus.** Aliasing a word documents actually use (e.g. `remittance` → `dmt`) strips its surface form from the index, so fuzzy can no longer bridge a typo to it — `remitance` would find nothing.
2. **The target must be a token that exists.** Mapping `cibil` onto a coined `creditscore` guarantees zero results.

`TOKEN_ALIASES` handles single tokens; `PHRASE_ALIASES` handles multi-word forms, applied to the raw query *before* MiniSearch tokenizes (the tokenizer would otherwise have already split them).

## Body index (long-form prose)

Labels and one-line summaries alone can't answer a lot of real queries — "penny drop" appears in the Bank Account Verification *description*, not its title. `search-body.json` closes that gap.

- **Produced by** `collectBodies()` in `vite-plugin-generate-markdown.ts`, which renders each product / industry / solution / endpoint / guide twin and runs it through `extractBody()`.
- **Keyed by** `searchItemId(category, slug)` — the same constructor `search-index.ts` uses to build `SearchItem.id`, so the two cannot drift. A test asserts every non-page/non-FAQ item's id round-trips through it.
- **Excludes pages and FAQs** by design: a page's content *is* its label and keywords, and an FAQ's answer is already its sublabel.
- **`extractBody`** (`src/lib/markdown/extract-body.ts`) drops frontmatter, the boilerplate canonical-URL blockquote, fenced code and pipe tables; it keeps heading *text* and non-boilerplate blockquote prose. Capped at 1500 chars/document — measured: 500 → 82 KB, 1500 → 160 KB, 3000 → 240 KB raw.
- **Dev**: served by the plugin's middleware at `/search-body.json`, cached in the plugin closure (336 ms cold → 2 ms warm). Not invalidated on HMR — restart the dev server after editing page data if the body index needs to reflect it.

## Files

- `src/lib/search-engine.ts` — MiniSearch config, synonyms, stopwords, ranking, `parseQuery`.
- `src/lib/search-engine.test.ts` — ranking behaviour + regression guards.
- `src/lib/search-index.ts` — `SearchItem` type, `searchItemId()`, `SEARCH_INDEX` builder (lazy chunk only).
- `src/lib/search-index.test.ts` — index integrity (unique ids, live `/docs` slugs).
- `src/lib/markdown/extract-body.ts` (+ `.test.ts`) — markdown → searchable prose.
- `vite-plugin-generate-markdown.ts` — `collectBodies()` + the `search-body.json` emit and dev route.
- `src/components/CommandPalette.tsx` — palette UI (Dialog + `ui/command.tsx` primitives).
- `src/components/Header.tsx` — triggers, ⌘K listener, lazy mount + idle prefetch.
- `index.html` / `src/index.css` — OS detection + kbd-hint visibility.

## Maintenance

- **Adding a synonym**: one line in `TOKEN_ALIASES` (single word) or `PHRASE_ALIASES` (multi-word) in `src/lib/search-engine.ts`. Check the two rules above first — the test suite enforces them.
- **Adding a searchable static page**: append to `PAGE_ITEMS` in `src/lib/search-index.ts`.
- **Curating the empty-query view**: edit `SUGGESTED_API_IDS` (APIs) or rely on `priority: 1` (industries/solutions); set `suggested: true` on page items.
- **Retuning ranking**: adjust the boosts or `TYPE_ALPHA` in `search-engine.ts`, then `npx vitest run src/lib/search-engine.test.ts`. The suite pins the cases that previously regressed.
- **Verifying chunk isolation after changes**: `npm run build`, then confirm `dist/assets/CommandPalette-*.js` exists, `grep -c cmdk dist/index.html` → 0, and a long product string (e.g. "domestic money transfer API") appears in only one dist chunk.
