# Palette router eval

Scores a ⌘K router — the rules + MiniSearch cards today, a model later —
against labelled real queries. Gate thresholds and process:
[palette router roadmap](../../docs/palette-router-roadmap.md) (Phase 1c).

## Label format (JSONL, one query per line)

```json
{"query":"dmt api","intent":"find_api","target":"action:find_api:dmt-api","split":"dev"}
{"query":"what is the weather today","intent":null,"split":"test"}
```

| Field | Meaning |
| ----- | ------- |
| `query` | the visitor's final query, as exported from `/admin` → Search logs |
| `intent` | `find_api` · `how_to_build` · `estimate_earnings` · `get_started`, or `null` for off-topic / plain search (right answer = no card) |
| `target` | optional: the card id the answer must point at (`action:<intent>:<slug>`), or a list when several are right (a product and its only endpoint). A `click` row's `clickedId` is a free hint for `find_api` targets |
| `result` | optional: a search item id (`api:pan-verification-api`, `sdk:go`) that must be in the **plain results'** top 3 — scores search itself, which the card metrics miss |
| `split` | `dev` (tune rules/model on these) or `test` (held out — never look at failures here while tuning) |

`sample.jsonl` shows the shape; it is not an eval set.

`audit.jsonl` is the synthetic query audit (2026-09-28): 164 hand-written
queries across the four intents, plain search and off-topic, labelled with
the ideal answer; 54 are `test`. Use it until the Phase 0b export exists, then
keep it alongside the real set.

## Building the set

1. `/admin` → Search logs → Export JSONL for the baseline window.
2. Dedupe by lower-cased query; drop obvious junk.
3. Label ~150 rows, **≥50 with `intent: null`**. Assign ~30% to `test`, at random, before looking at router output.
4. Keep the labelled file out of git if it contains anything a visitor typed that you would not publish (queries are redacted, but names can survive).

## Running

```sh
npm run build   # fresh dist/search-body.json
PALETTE_EVAL_FILE=scripts/palette-eval/audit.jsonl \
PALETTE_EVAL_BODIES=dist/search-body.json \
  npx vitest run src/lib/palette-actions/eval.test.ts --reporter=default
```

Prints every **dev** row that misses (card or plain top 3), the plain-search
top-3 hit rate, and `intentAccuracy`, `offTopicRefusal`, `cardPrecision`,
`targetAccuracy` for `all`, `dev` and `test`. Test rows count only in the
aggregate. Without `PALETTE_EVAL_BODIES` it scores the label-only index (what
the palette has before the body index loads). Without `PALETTE_EVAL_FILE` only
the scorer's own unit test runs.

`--reporter=default` matters: under an AI agent, vitest picks a reporter that
hides `console` output of passing tests, so the tables never print.
