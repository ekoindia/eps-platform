# ⌘K palette telemetry

Phase 0 of the on-device query router (Needle in ⌘K). Before a model can
route palette queries, we need two things the palette never recorded: a
**baseline** (how often search fails or is abandoned) and **real queries** to
build the router's eval set. This feature collects both, with query text kept
off third-party servers.

Plan and status for everything after this phase:
[palette router roadmap](../palette-router-roadmap.md).

## What is recorded

One report per palette session that had a query, sent when the session ends:

| Outcome   | When                                              |
| --------- | ------------------------------------------------- |
| `click`   | a result was chosen (category + 1-based rank)     |
| `ask_ai`  | the "Ask AI" row was chosen                       |
| `abandon` | closed by Esc / outside click with nothing chosen |

Each report carries the search, its outcome, and context:

| Field | Meaning |
| ----- | ------- |
| `query`, `scope`, `resultCount`, `outcome` | the last query and how it ended |
| `clickedCategory`, `clickedRank`, `clickedId`, `clickedLabel` | on `click`: which result, where it ranked, its id and the title the visitor saw |
| `page` | normalised path the palette was opened on — no query string or hash; segments with ≥4 digits or a UUID become `:id` |
| `auth` | `anon` · `developer` · `signup` · `admin` · `unknown` (`/me` still loading) |
| `stage` | developers only: lifecycle (`lead`, `onboarded`, `active`, `kyc-pending`, `kyc-rejected`, `inactive`, `unknown`) |
| `trigger` | `keyboard` · `header_button` · `mobile_button` |
| `device` | `mobile` (viewport ≤767px) · `desktop` |
| `refinements` | queries the visitor paused on (≥800 ms) before the final one — struggle signal |
| `durationMs` | palette open → outcome |
| `actionIntent` | intent of the action card shown for the final query (`find_api`…), clicked or not; a card click itself is `outcome: click` with `clickedCategory: "action"` and no rank |
| `bodyIndexLoaded` | whether the long-form page-text index had loaded; `false` on a zero-result search = maybe a loading gap, not a content gap |

Two destinations, deliberately different:

| Destination | Gets | When |
| ----------- | ---- | ---- |
| GTM `palette_search` event | counts + `queryLength`, `auth`, `trigger`, `device`, `actionIntent` — **never** text, page, stage or clicked label/id | every session with a query |
| eps-backend `POST /telemetry/palette` | every field above, query redacted | sampled sessions only (`VITE_PALETTE_QUERY_SAMPLE_RATE`) |

Zero-result rate = `resultCount == 0`; abandon rate = `outcome == "abandon"`.

## Privacy

- **Redacted twice.** The site's `redactIdentifiers` (`src/lib/analytics.ts`)
  strips emails, key-like tokens (≥24 chars with a digit), PANs and six-plus
  digit numbers (spaced or hyphenated) before sending. The backend redacts
  again with its own copy (`packages/eps-backend/src/audit/redact.ts`) because
  a stale client cannot be trusted. `src/lib/analytics.parity.test.ts` fails if
  the two lists drift.
- **Not linked to an account.** The request is sent `credentials: "omit"` (no
  session cookie), and the row carries no ip, request id, session, mobile, name
  or org — only what was asked, what happened, and the coarse context above.
- **Small user base ⇒ context can re-identify.** "A `kyc-rejected` developer on
  `/console/kyc` at 10:03" may point at one partner. So: `ts` is stored
  **rounded to the hour** (server-side, `hourOf`); stage is the lifecycle only;
  and page, stage and clicked label/id never go to GTM, where GA4 would join
  them to its own client ids. Treat the admin page as personal data anyway.
- **Names and addresses survive redaction.** That is why text never goes to
  GTM, only to our own VM.
- **Off by default.** Sample rate unset = 0 = no text leaves the browser. Set it
  (planned `0.1`) only once the privacy policy covers search logs.
- **Policy clause follows the flag.** `/privacy-policy` §4 renders a "Site
  search queries" paragraph only when the sample rate is > 0, so the published
  policy and the build always agree. Changing what is collected, who processes
  it, or how long it is kept means changing that paragraph in the same commit.

## Backend

`POST /telemetry/palette` (`packages/eps-backend/src/http/paletteLog.ts`):
anonymous, `text/plain` JSON body (no CORS preflight), ≤4 KB, 60 reports per IP
per 10 min, answers `204`. Writes one row to the `palette_query` table in a
SQLite file (`packages/eps-backend/src/analytics/paletteStore.ts`, Node's
built-in `node:sqlite`):

| Column | Notes |
| ------ | ----- |
| `id`, `ts` | autoincrement; ISO-8601 UTC **rounded down to the hour** |
| `query` | redacted, ≤200 chars |
| `scope`, `result_count`, `outcome` | as sent |
| `clicked_category`, `clicked_rank`, `clicked_id`, `clicked_label` | null unless `outcome = click`; label redacted, ≤200 |
| `page` | redacted, ≤200, must start with `/` |
| `auth`, `stage`, `trigger`, `device` | allow-listed values only |
| `refinements`, `duration_ms` | bounded integers (≤1000; ≤1 day) |
| `body_index_loaded` | 0/1 (read back as boolean) |

All context columns are optional: a report from an older site build stores
nulls rather than failing. They were added after the first release —
`openPaletteStore` adds any missing column to an existing file on startup
(`ADDED_COLUMNS`, append-only), so no manual migration.

No ip, session or request id — by design. Production path:
`/var/lib/eps-analytics/search-logs.db` on the `eps-analytics-data` volume
(set in `docker-compose.prod.yml`). Unset `ANALYTICS_DB_PATH` = in-memory,
emptied on restart (local dev). Rows older than **365 days** are purged at
startup and daily, matching the privacy policy's 12 months. An insert failure
(disk full) is logged and swallowed — telemetry never fails a search.

No nginx or Vercel change needed: both already forward every backend path.

## Admin: exploring and exporting

`/admin` → **Search logs** tab (admin session only; `AdminSearchLogs.tsx`):

- **Filter** — date range (UTC days, inclusive; default last 30 days), query
  substring, outcome, who (`auth`), and account stage (shown once "Developer"
  is picked). Clicking a query in either top table filters to it.
- **Summary cards** — searches, % no results, % clicked, % abandoned, % asked AI.
- **Top queries / top failing queries** — 25 each, case- and space-folded.
  Failing = no results or abandoned: the synonym and content backlog.
- **Log** — newest first, 50 per page, *Load more*. Columns: hour, query,
  results, outcome, clicked (label and rank), page, who (auth · stage), effort
  (tries · seconds).
- **Export JSONL / CSV** — every row matching the filter, streamed. CSV defuses
  formula-leading cells (`=`, `+`, `-`, `@`) since queries are visitor-typed.

Backend routes: `/admin/search-logs/{overview,rows,export}` — see the
eps-backend README "Search logs" section. For ad-hoc SQL on the VM, use a
backup copy (see `eps-backend-vm-deploy.md`) rather than the live file.

## GTM / GA4 setup

The site only pushes `palette_search` into the dataLayer of container
`GTM-MLL3LZZD` (`index.html`); nothing reaches GA4 until the container maps it.
One-time setup:

1. **Variables** → User-Defined → Data Layer Variable (Version 2), one each for
   `scope`, `resultCount`, `outcome`, `clickedCategory`, `clickedRank`,
   `queryLength`, `auth`, `trigger`, `device`, `actionIntent` (e.g. `DLV - palette outcome`).
2. **Trigger** → Custom Event, event name `palette_search`, all custom events
   (`CE - palette_search`).
3. **Tag** → Google Analytics: GA4 Event, event name `palette_search`, trigger
   `CE - palette_search`, parameters in GA4's snake_case:

   | GA4 parameter      | Value                              |
   | ------------------ | ---------------------------------- |
   | `scope`            | `{{DLV - palette scope}}`          |
   | `result_count`     | `{{DLV - palette resultCount}}`    |
   | `outcome`          | `{{DLV - palette outcome}}`        |
   | `clicked_category` | `{{DLV - palette clickedCategory}}`|
   | `clicked_rank`     | `{{DLV - palette clickedRank}}`    |
   | `query_length`     | `{{DLV - palette queryLength}}`    |
   | `auth`             | `{{DLV - palette auth}}`           |
   | `trigger`          | `{{DLV - palette trigger}}`        |
   | `device`           | `{{DLV - palette device}}`         |
   | `action_intent`    | `{{DLV - palette actionIntent}}`   |

4. **Preview** (Tag Assistant): search in ⌘K and click a result, then search and
   press Esc — expect two `palette_search` events, the second with
   `outcome: abandon` and empty click fields. Confirm in GA4 DebugView, then
   **Publish**.
5. **GA4 Admin → Custom definitions** (reports ignore unregistered params; data
   shows only from registration on, after 24–48 h):
   - custom dimensions (Event scope): `outcome`, `scope`, `clicked_category`,
     `result_count` (a dimension so it can be filtered `= 0`), `auth`,
     `trigger`, `device`, `action_intent`;
   - custom metrics (Standard): `query_length`, `clicked_rank`.

Reading it — Explore → Free form, filter event name `palette_search`: rows
`outcome` × event count gives click / abandon / Ask-AI rates; filter
`result_count` = `0` for the zero-result rate. A funnel from `palette_search` to
the signup event is what GA4 adds over the admin page: its rows carry no session,
so only GA4 can join search to acquisition and conversion.

Gotchas:

- **Keep the undefined keys.** GTM's data model persists values across pushes.
  `reportPaletteSearch` sends `clickedCategory` / `clickedRank` as explicit
  `undefined` on non-click outcomes to overwrite the previous click; dropping
  those keys would make abandoned searches inherit the last click's category.
- **GA4 undercounts.** Ad blockers and consent banners stop GTM. The SQLite log
  on `/admin` does not depend on it — use that for exact counts.

## Building the eval set

Export JSONL for the range, dedupe, label intents/slots, and keep a held-out
test split that is never used for fine-tuning (see the Needle plan's gate).

## Files

- `src/lib/palette-telemetry.ts` (+ test) — `isSampled`, `reportPaletteSearch`.
- `src/components/CommandPalette.tsx` — one report per session (`report()`).
- `src/lib/config/features.ts` — `PALETTE_QUERY_SAMPLE_RATE`.
- `src/lib/analytics.ts` — shared `redactIdentifiers`.
- `src/components/admin/AdminSearchLogs.tsx` (+ test), `AdminConsole.tsx` — admin tab.
- `src/lib/auth/client.ts` — `authClient.adminSearchLogs`, `searchLogQuery`.
- `packages/eps-backend/src/http/paletteLog.ts` (+ test), `src/audit/redact.ts`.
- `packages/eps-backend/src/analytics/paletteStore.ts` (+ test) — schema, reads, retention.
- `packages/eps-backend/src/http/searchLogs.ts` (+ test) — admin routes, CSV.
