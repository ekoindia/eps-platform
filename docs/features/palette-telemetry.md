# ⌘K palette telemetry

Phase 0 of the on-device query router (Needle in ⌘K). Before a model can
route palette queries, we need two things the palette never recorded: a
**baseline** (how often search fails or is abandoned) and **real queries** to
build the router's eval set. This feature collects both, with query text kept
off third-party servers.

## What is recorded

One report per palette session that had a query, sent when the session ends:

| Outcome   | When                                              |
| --------- | ------------------------------------------------- |
| `click`   | a result was chosen (category + 1-based rank)     |
| `ask_ai`  | the "Ask AI" row was chosen                       |
| `abandon` | closed by Esc / outside click with nothing chosen |

Two destinations, deliberately different:

| Destination                       | Gets                                                               | When                                      |
| --------------------------------- | ------------------------------------------------------------------ | ----------------------------------------- |
| GTM `palette_search` event        | `scope`, `resultCount`, `outcome`, `clickedCategory`, `clickedRank`, `queryLength` — **never text** | every session with a query                |
| eps-backend `POST /telemetry/palette` | the same fields **plus redacted query text**                   | sampled sessions only (`VITE_PALETTE_QUERY_SAMPLE_RATE`) |

Zero-result rate = `resultCount == 0`; abandon rate = `outcome == "abandon"`.

## Privacy

- **Redacted twice.** The site's `redactIdentifiers` (`src/lib/analytics.ts`)
  strips emails, key-like tokens (≥24 chars with a digit), PANs and six-plus
  digit numbers (spaced or hyphenated) before sending. The backend redacts
  again with its own copy (`packages/eps-backend/src/audit/redact.ts`) because
  a stale client cannot be trusted. `src/lib/analytics.parity.test.ts` fails if
  the two lists drift.
- **Not joinable.** The request is sent `credentials: "omit"` (no session
  cookie), and the log line carries no ip, request id or session — only what
  was asked and what happened.
- **Names and addresses survive redaction.** That is why text never goes to
  GTM, only to our own VM.
- **Off by default.** Sample rate unset = 0 = no text leaves the browser. Set it
  (planned `0.1`) only once the privacy policy covers search logs.

## Backend

`POST /telemetry/palette` (`packages/eps-backend/src/http/paletteLog.ts`):
anonymous, `text/plain` JSON body (no CORS preflight), ≤2 KB, 60 reports per IP
per 10 min, answers `204`. Writes one stdout line:

```json
{"type":"palette_query","ts":"…","query":"verify pan …","scope":"all","resultCount":3,"outcome":"click","clickedCategory":"endpoint","clickedRank":1}
```

No nginx or Vercel change needed: both already forward every backend path.

## Exporting the eval set

Retention is the container log rotation (10 MB × 5), so lines roll off in days.
Export weekly on the VM:

```sh
dc logs --since 8d eps-backend | jq -Rc 'fromjson? // empty | select(.type=="palette_query")' \
  >> ~/palette-queries.jsonl
```

Then dedupe, label intents/slots, and keep a held-out test split that is never
used for fine-tuning (see the Needle plan's gate).

## Files

- `src/lib/palette-telemetry.ts` (+ test) — `isSampled`, `reportPaletteSearch`.
- `src/components/CommandPalette.tsx` — one report per session (`report()`).
- `src/lib/config/features.ts` — `PALETTE_QUERY_SAMPLE_RATE`.
- `src/lib/analytics.ts` — shared `redactIdentifiers`.
- `packages/eps-backend/src/http/paletteLog.ts` (+ test), `src/audit/redact.ts`.
