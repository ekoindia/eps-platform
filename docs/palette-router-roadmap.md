# ⌘K palette router — roadmap & progress

**Read this first when resuming.** It is the canonical plan and status for
turning the ⌘K palette from keyword search into an action router (rules first,
then possibly the on-device Needle model). Every session that changes the
status updates the board and appends to the progress log in the same commit.

- Goal: cut onboarding dropoff for developers and prospective partners on the
  docs and product pages, by answering intent ("how do I go live", "what will I
  earn on 500 DMT a month") with a direct action, not a list of links.
- Related docs: [palette telemetry](features/palette-telemetry.md) (Phase 0,
  shipped), [command palette search](command-palette-search.md) (current
  MiniSearch engine), [docs-chat agent](docs-chat-agent.md) (the `/chat/ask`
  fallback).

## Status board

| Phase | What | Status | Owner / date |
| ----- | ---- | ------ | ------------ |
| 0 | Palette telemetry: GTM counts + redacted query log in SQLite, admin Search logs page | ✅ **Live in prod**, verified 2026-09-28 | — |
| 0b | Baseline data collection (2–4 weeks at sample rate 1) | ⏳ **Running since 2026-09-28** — first review ~2026-10-12, eval-set cut ~2026-10-26 | — |
| 1a | Rules + MiniSearch **action cards** (zero-MB comparator) | ✅ All 4 intents built 2026-09-28; flag **on in prod** since PR #131 | 2026-09-28 |
| 1a+ | Query audit: 164 synthetic labelled queries (`scripts/palette-eval/audit.jsonl`), misses fixed | ✅ 2026-09-28 — held-out test at the gate (intent 0.89, refusal 0.91, precision 0.90); deployed 2026-09-29 (PR #134), `bodyIndexLoaded: true` confirmed in prod | 2026-09-29 |
| 1b | Needle spike: JS API, browser cost, base-model sanity | ⬜ Not started | — |
| 1c | Eval set + gate run (comparator vs Needle, end to end) | ⬜ Needs 0b data | — |
| 2 | Needle build behind `VITE_SHOW_NEEDLE` | ⬜ Only if Needle clearly beats 1a at the gate | — |
| 3 | Enable `/chat/ask` for developers + real concurrent A/B | ⬜ | — |
| — | Doc-scan quality / right-document checks | ⏸ Separate track, not Needle (text-only model) | — |

Legend: ✅ done · ⏳ in progress / waiting · ▶️ next · ⬜ not started · ⏸ parked

## Decisions (and why)

| Topic | Decision |
| ----- | -------- |
| Audience | Docs developers and prospects on product pages — not partners' retailers |
| Role of a model | Router only: pick an action and fill its slots; answers come from data already in the browser. Needle writes no free text |
| Fallback for open questions | `/chat/ask`, **signed-in developers/admins only** — no public LLM endpoint. Anonymous visitors get cards + MiniSearch (+ a "sign up to ask AI" nudge later) |
| v1 intents | `find_api`, `how_to_build`, `get_started`, `estimate_earnings` (≤5 tools is where Needle is accurate) |
| Entity resolution | The router extracts a verbatim `subject` + typed slots; **MiniSearch** resolves the subject — new APIs need no retraining |
| UX | Never auto-navigate. Confident → pinned card above results; unsure → "Did you mean"; nothing → plain results |
| `get_started` | Deterministic, session-aware: the answer comes from `NextStepsCard`'s own logic, not the router |
| Model path | Base Needle model first; if it fails the gate, **hosted** fine-tune (keeps calibrated confidence; ask before any paid job). Local LoRA rejected (no confidence head) |
| Loading | Lazy on first ⌘K open; skipped on Save-Data or slow-2g/2g/3g |
| Hosting weights | Self-hosted, pinned by sha256, immutable cache, not in git |
| Telemetry privacy | Query text never to GTM; redacted twice; rows unlinked to accounts; `ts` rounded to the hour; page/stage/label never to GA4 (small user base ⇒ re-identification risk) |
| Retention | 365 days, purged daily; privacy clause says 12 months (legal-reviewed) |
| Sample rate | 1 (all sessions) — the user base is small |
| Deploy cadence | **Ship every improvement to prod as soon as it is verified** (tests + browser) — decided 2026-09-28, deadline to grow EPS business. No holding fixes for review dates or to keep the baseline clean; instead log each deploy date in the progress log so telemetry can be compared before/after by date |
| Comparator first | Needle ships only if it beats rules + MiniSearch **by a clear margin, end to end**. If rules are good enough, the 29 MB model is not needed |

## Phase 0 — telemetry (✅ shipped)

What it records and where: see [palette telemetry](features/palette-telemetry.md).
Admin view: `/admin` → Search logs (summary, top and top-failing queries,
filters by date/query/outcome/who/stage, paged log, JSONL/CSV export).

Commits (all on `dev`, merged to `main`): `a763b0e` telemetry + redaction ·
`b213d2f`, `483fe4a` privacy clause · `0151c0e` Node 24 · `047ba75` SQLite store +
admin tab · `6943525` local demo admin login · `d5a4885` env docs · `9d7fac2`
GTM setup doc · `d94b427` GTM undefined-key test · `c39ab92` context fields
(page, auth, stage, clicked result, effort, trigger, device) · `25aa127` bundle
fix (see gotchas).

## Phase 0b — baseline (⏳ running)

- **~2026-10-12 (week 2) review** on `/admin` → Search logs, last 14 days:
  zero-result %, abandon %, click-through %, top failing queries, pages with
  the most failing searches, effort (tries/seconds) by `auth`/`stage`.
  Ship quick wins from the failing list immediately (synonyms in
  `TOKEN_ALIASES`/`PHRASE_ALIASES`, word forms in `STEM_RULES`,
  `src/lib/search-engine.ts`; missing content) — they raise the bar every later
  phase must clear. Search fixes also ship as soon as found, before this review
  (see Deploy cadence); compare numbers around each logged deploy date.
- **~2026-10-26 eval-set cut**: export JSONL, dedupe, label (below).

## Phase 1a — rules + MiniSearch action cards (✅ done)

The zero-MB comparator. Useful even if Needle never ships.

**Shape (proposed, pending the open questions):**

- `src/lib/palette-actions/` — pure, unit-tested:
  - `normalizeAmounts(query)` — `1 lakh`/`2 crore`/`5k`/`₹5,000` → digits.
  - `detectIntent(query)` — ordered regex rules per intent → `{intent, subject, slots}` or null.
  - resolvers, one per intent, returning a card model or null:
    - `find_api` → MiniSearch over the **`endpoint`** category (REST operations; the `api` category is product pages) → endpoint card (method, path, docs link, Try-it link). Top 3 when scores are close.
    - `how_to_build` → recipes (4 today: DMT Fino send money, AePS Fingpay withdrawal, BBPS bill payment, BBPS recharge) → recipe card. **Built** differently from this plan: recipes were added to the search index (category `recipe`, ~few KB in the lazy palette chunk) instead of lazy-fetching `/agent/eps.json` — one resolution path (MiniSearch), and recipes became findable in plain search too.
    - `get_started` → session-aware next step. **Built**: `deriveNextStep` (`src/lib/console/next-step.ts`) holds NextStepsCard's spotlight choice (E-sign → KYC upload → none), used by both. Inputs: lifecycle state, E-sign entitlement, optional KYC-pack action; fee state is unknowable so the fee is always a secondary link. Loading/anon → sign-up card; admin → none. The palette skips the KYC-pack fetch (names the step from the lifecycle).
    - `estimate_earnings` → deep link `/pricing?tab=payments&pay=…` or `?tab=dmt&dmt=…` (DMT has its own tab and param). Product names map to **calculator ids** (`dmt`, `aeps-cashout`, `bbps-electricity`…), not families; slots = product + average amount + monthly count. **Built**: serializers moved to the pricing data files; tabs + both calculators follow external URL changes; the card also shows the calculator's headline number.
- `CommandPalette.tsx` — pinned card slot above results; Enter opens it; never auto-acts.
- Telemetry — record which card was shown and whether it was used (new `actionIntent` field; card click = `outcome: click`, `clickedCategory: "action"`), so the gate can score it from real sessions.
- Flag `VITE_SHOW_PALETTE_ACTIONS` (default off) until the gate.
- Shared eval harness `scripts/palette-eval/` scoring the **same** labelled JSONL for rules now and Needle later: intent accuracy, slot accuracy, card precision, off-topic refusal.

**Decided 2026-09-28:** all four intents, **one intent per commit** in this
order — `find_api` → `how_to_build` → `estimate_earnings` → `get_started` —
on `dev` behind `VITE_SHOW_PALETTE_ACTIONS` (default off), so partial work is
safe to merge. Runtime A/B waits for Phase 3.

| Intent | Status | Commit |
| ------ | ------ | ------ |
| shared scaffolding (flag, `normalizeAmounts`, `detectIntent`, card slot, telemetry, eval harness) | ✅ 2026-09-28 | see log |
| `find_api` | ✅ 2026-09-28 — product or endpoint card, endpoints with Try-it | see log |
| `how_to_build` | ✅ 2026-09-28 — recipe card + Step 1 link; falls back to `find_api`; recipes now searchable (`recipe` category) | see log |
| `estimate_earnings` | ✅ 2026-09-28 — pre-filled calculator link + the calculator's own number on the card; calculators follow URL changes | see log |
| `get_started` | ✅ 2026-09-28 — session-aware; shares `deriveNextStep` with NextStepsCard | see log |

## Query audit (✅ 2026-09-28)

164 hand-written queries (`scripts/palette-eval/audit.jsonl`, 54 held out as
`test`) labelled with the ideal answer: card target, or no card, plus an
optional plain-search top-3 `result`. Run and label format:
[scripts/palette-eval/README.md](../scripts/palette-eval/README.md).

| Full-text engine | intent | refusal | precision | target | plain top-3 |
| ---------------- | ------ | ------- | --------- | ------ | ----------- |
| before, dev | 0.90 | 0.83 | 0.73 | 0.80 | 44/53 (all) |
| after, dev | 0.98 | 0.96 | 0.95 | 0.98 | 48/53 (all) |
| before, **test** | 0.87 | 0.91 | 0.84 | 0.80 | — |
| after, **test** | 0.89 | 0.91 | 0.90 | 0.87 | — |

"Before" used the original single-target labels. Between runs, 18 rows were
widened to accept a product **or** its only endpoint (a labelling policy,
applied to test rows too without looking at their output), so part of the
target/precision gain is that relabel, not the fixes. Test barely clears the
gate: the rules generalise less than dev suggests.

Fixes:

- **Full-text search was off in prod** — see gotchas (`constructor`).
- Cards use **strict** search (every subject word must match; no OR
  fallback) — killed "cibil score api" → IP Verification, "how to cook
  biryani" → DMT recipe.
- `find_api` shows no card when the best overall hit is a page, guide, FAQ or
  SDK ("api pricing", "how does authentication work").
- Rules: a lone verb ("verify") is no intent; "payout" no longer means
  earnings; "onboard sender/user/…" is a how-to, not account onboarding;
  "start using/with" → `get_started`; `check`, `lookup`, `docs`, `app` are
  request phrasing, not subject.
- Search content: `golang` → `go` alias; FASTag on BBPS; product names and
  "fees" on the Pricing page.

Known dev misses left: "payout api" (fuzzy → UPI Verification), "how to open a
bank account" (→ Get User's Services), "api documentation" (Docs page loses
to "document" endpoints on type weight), "fingpay" (Fingpay endpoints outrank
the AePS product — acceptable), "endpoint to fetch ifsc details" (→ Get Bank
Details).

## Phase 1b — Needle spike (⬜)

Throwaway branch; nothing merges.

1. Download the `wasm` build (`needle.js`, `needle.wasm`, `needle3.cact`) into scratch; read `needle.js`/`needle.h` for the JS API (undocumented).
2. Check whether it needs threads / SharedArrayBuffer / COOP-COEP headers.
3. Measure on a mid-range Android and a desktop, in a Web Worker: first-load time for ~29 MB, per-query latency, `prefill_tps`/`decode_tps`/`peak_ram_mb`.
4. ~40 hand-written queries against the 4 tool schemas — a sanity signal only; the real gate needs the Phase 0b eval set.

New dependency to approve first: the `cactus-needle` Python package in a
scratch virtualenv (reference harness), outside the repo.

Tool-design rules learnt from Needle's docs: tool names in users' words;
descriptions state facts, never instructions; constraints in the schema
(enum/min/max), not prose; only digits or number words count as evidence for a
number (hence `normalizeAmounts`); `triggers` regexes route and force a call —
don't add an `and|then` guard blindly ("bank account and IFSC verification" is
one intent).

## Phase 1c — eval set + gate (⬜)

- ~150 unique real queries from the Phase 0b export, labelled with: intent (or
  none), subject, slots, expected card. **≥50 off-topic.** The clicked result
  (`clickedId`/`clickedLabel`) is a free label for `find_api`.
- Hold out a test split that is never used for fine-tuning.
- **Gate (end to end, per candidate):** intent ≥85%, off-topic refusal ≥90%,
  pinned-card precision ≥90%, browser p95 latency <300 ms after load. Needle
  must beat rules + MiniSearch by a clear margin to proceed to Phase 2.
- Gate fail for Needle → price the hosted fine-tune, ask, then train on data
  synthesised from specs + recipes + labelled queries; pick the smallest passing
  depth (smaller download); re-gate.

## Phase 2 — Needle build (⬜, conditional)

Behind `VITE_SHOW_NEEDLE`. Web Worker with debounce (~250 ms), serialised calls,
query ids, stale-result drop, 1 s timeout → rules/MiniSearch fallback. Pinned
self-hosted weights (sha256), immutable cache headers, `application/wasm`.
Confidence tiers: ≥0.7 pinned card, 0.1–0.7 or suppressed → "Did you mean",
empty → plain results.

## Phase 3 — chat + A/B (⬜)

`/chat/ask` rollout per [docs-chat agent](docs-chat-agent.md) (developers/admins
only). A/B must be **concurrent** with stable assignment (hashed cookie,
runtime flag — not a build flag vs history), exposure = palette opens, outcome =
signup started/completed, chat availability equal across arms.

## Gotchas learnt (keep adding)

- **`node:` builtins and tsup.** tsup 8.5 defaults `removeNodeProtocol: true`,
  turning `node:sqlite` into bare `sqlite` → prod crash-loop, while every test
  passed (vitest/tsx run TS source). Fixed in `25aa127`; CI now checks bundle
  imports. **Verify backend changes by booting `dist/`, not just tests.**
- **A 401 signs the user out.** The client treats any 401 as an expired
  session. An admin without GitHub (local demo login) must never mount the docs
  tab, whose calls 401 `NO_GH_TOKEN`.
- **GTM keeps dataLayer values across pushes.** Non-click reports send click
  keys as explicit `undefined`; a test pins it.
- **Search categories:** `api` = product pages, `endpoint` = REST operations.
- **Redaction lives twice** (site + backend) and is pinned by
  `src/lib/analytics.parity.test.ts`.
- **Word forms need stemming, not aliases.** "verify pan" found only *Bulk*
  PAN Verification: MiniSearch has no stemming, and synonym rule 1 forbids
  aliasing words the corpus uses. Fixed 2026-09-28 with `STEM_RULES`: index
  keeps surface form + root (so partial words and typos still match), query
  sends the root only. Stemming both sides alone would break mid-word typing.
- **`setSearchParams` drops the URL hash**, and `ScrollToTop` used to try a
  hash once (before lazy routes rendered) and scroll to top on *any* hash
  change — so every `/page?x#section` link into a lazy page landed at the
  top. Fixed 2026-09-28: poll for a visible target, top-scroll only on a
  pathname change.
- **Same-route links don't remount.** A card linking `/pricing?…` from
  `/pricing` only changes the query; components reading the URL once in a
  `useState` initialiser must also follow later changes.
- **cmdk in jsdom:** components rendering cmdk items need
  `Element.prototype.scrollIntoView` stubbed in the test.
- **`Object.prototype` names in a lookup table.** `TOKEN_ALIASES[term]`
  returned `Object.prototype.constructor` for the word "constructor" (in the
  Node/PHP SDK pages), MiniSearch threw `key must be a string`, and the
  palette's silent body-index fetch fell back to labels only — in prod, since
  at least the SDK pages. So every Phase 0 row so far has
  `bodyIndexLoaded: false`: the baseline measures label-only search. Fixed
  2026-09-28 with an own-key check.
- **Vitest hides eval output under an agent** — pass `--reporter=default`.
- **Module mocks hide constants:** tests mocking `@/lib/auth/client` spread
  the real module (`importOriginal`) so `LIFECYCLES` still exists.

## Progress log

Newest first. One entry per working session that changes status.

- **2026-09-29** — Query-audit fixes (full-text index `constructor` fix,
  strict card search, rule and content fixes) merged to `main` in PR #134
  at 08:23 IST: **deploy date for before/after comparison.** Rows before
  it have `bodyIndexLoaded: false`; rows after should be `true`. The
  user confirmed `true` in the prod export. Admin Search logs now also
  shows a "Full-text index loaded" summary card (% of searches), so the
  split is visible without an export. Next: fix the known dev misses,
  then the Phase 1b spike or the ~2026-10-12 review.

- **2026-09-28** — Query audit done (see section). Found and fixed a prod bug:
  the full-text body index never loaded (`constructor` alias lookup), so
  search has been label-only and every telemetry row says
  `bodyIndexLoaded: false` — compare before/after this deploy. Cards now use
  strict search. Held-out test at the gate: intent 0.89, refusal 0.91,
  precision 0.90. Browser-verified on the dev server (body index loads,
  junk queries show no card, fixed queries show the right card). Next: deploy,
  then Phase 1b or wait for the ~2026-10-12 review.

- **2026-09-28** — PR #132 (earnings + next-step cards, hash-link fix,
  in-memory search-log banner) and PR #133 ("go live" → Sign Up + Docs, was
  Go SDK + PAN Lite) deployed; #133 verified in prod by the user. Deploy date
  for before/after comparison. Next: query audit (~120 realistic queries,
  fix misses, keep as the eval set); "golang" → nothing is a known miss.

- **2026-09-28** — `get_started` built; **Phase 1a complete** (all four
  intents). `deriveNextStep` extracted from NextStepsCard (its 26 tests pass
  unchanged); `useRoleTransactionList` gained an `enabled` flag so the palette
  fetches the E-sign list for developers only. Browser-verified as a visitor
  ("how do i go live" → sign-up card, no `/connect` call). Developer path
  covered by unit tests only — no local developer login. Next: Phase 0b
  review with real data, Phase 1b Needle spike.

- **2026-09-28** — PR #131 merged and `VITE_SHOW_PALETTE_ACTIONS` turned on
  in prod by the user (deploy date for before/after comparison): search
  stemming, searchable recipes, `find_api` + `how_to_build` cards live.
- **2026-09-28** — `estimate_earnings` built: card shows the calculator's own
  number (DMT take-home / AePS-BBPS gross) and opens the calculator
  pre-filled. Pricing tabs + calculators now follow external URL changes;
  `ScrollToTop` fixed for hash links into lazy pages (sitewide). Browser-
  verified from /docs (DMT, ₹8,102 card = page) and on /pricing itself (AePS
  1,000 × ₹3,000, ₹12,000 card = page, tab switched, scrolled). Next:
  `get_started`.

- **2026-09-28** — `how_to_build` built (flag off): recipes indexed as a new
  `recipe` search category (were not searchable at all), rule ahead of
  `find_api`, card = recipe + Step 1 link, fallback to `find_api` when no
  recipe matches. Browser-verified: "how do i integrate dmt" → DMT recipe card
  → Enter opens `/recipe/dmt-fino-send-money`. PR #131 (stemmer + earlier
  commits) green, awaiting merge. Next: `estimate_earnings`.

- **2026-09-28** — Search fix: word-form stemming (`STEM_RULES` in
  `src/lib/search-engine.ts`), "verify pan" now returns the PAN Verification
  product + all PAN endpoints, same as "pan verification"; the find_api card
  follows. Browser-verified. Deploy cadence changed to ship-as-verified.

- **2026-09-28** — Phase 1a scaffolding + `find_api` built on `dev` behind
  `VITE_SHOW_PALETTE_ACTIONS` (off): `src/lib/palette-actions/` (amount
  normaliser, ordered intent rules, subject extraction, resolver),
  `PaletteActionCard`, `actionIntent` telemetry end to end (site, GTM, backend
  column, CSV), eval scorer + `scripts/palette-eval/`. Browser-verified: "is
  there an api to fetch a bbps bill" → card → Try it → docs page with the
  Try-it dialog open and prefilled, also detail→detail. Built backend `dist`
  booted and accepted an `actionIntent` report. Next: `how_to_build`.

- **2026-09-28** — Phase 0 verified in prod by the user (logs recording; GTM
  and legal review done; sample rate 1). Baseline clock started. Roadmap doc
  created. Phase 1a decided: all four intents, one per commit, on `dev`
  behind `VITE_SHOW_PALETTE_ACTIONS` (off). Starting with shared scaffolding
  + `find_api`.
- **2026-09-28** — Context fields added to telemetry (`c39ab92`), hour-rounded
  timestamps, privacy clause reworded.
- **2026-09-27** — SQLite store + admin Search logs (`047ba75`), local demo
  admin login (`6943525`), Node 24 (`0151c0e`). Prod crash-loop from the
  `node:sqlite` bundle rewrite, fixed in `25aa127`.
- **2026-09-27** — Palette telemetry shipped (`a763b0e`); plan grilled and
  approved (Needle as router, rules comparator first, instrument before
  building).
