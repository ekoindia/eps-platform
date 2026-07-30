# Feature: Transaction History

The signed-in developer's own transactions, at `/console/transactions`. Ported
from Eloka's (`wlc-webapp`) History feature — see
`docs/features/transaction-history.md` in that repo.

> **Status: wired to upstream.** The page calls interaction 154 for real. The
> fixture path, the `EKO_TRANSACTIONS_MOCK` flag and the `501 NOT_WIRED` guard
> are gone. What remains unconfirmed against a live UAT account is listed in
> [§Still unconfirmed](#still-unconfirmed) — none of it blocks the call.

## Shape

| Piece                     | File                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| Types + all pure logic    | `src/lib/console/transactions.ts`                                                           |
| Page                      | `src/pages/console/Transactions.tsx`                                                        |
| Client method             | `transactionsClient.search` in `src/lib/auth/client.ts`                                     |
| BFF route                 | `packages/eps-backend/src/http/transactions.ts`                                             |
| Upstream adapter + mapper | `getTransactionHistory` / `mapTransactionRows` in `packages/eps-backend/src/clients/eko.ts` |
| Account resolution        | `selectEvalueAccountId` in `packages/eps-backend/src/clients/accounts.ts`                   |
| Real captured response    | `packages/eps-backend/src/clients/transactions.sample.ts`                                   |

Columns: expand toggle · Summary · Transaction Amount · Debit · Credit · Running
Balance · Date & Time · Status. Expanding a row reveals "Other Details" (status,
amount, TID, and whichever counterparty fields the row carries).

**Not ported:** Export (PDF/Excel), the Columns show/hide toggle, the
network/admin statement view, the multi-wallet account switcher, and the expanded
row's Report Issue / Print / Share actions. All are additive later.

Eloka drives its table from an 918-line `historyParametersMetadata` array. That
engine exists to serve two views with runtime-dynamic columns, export, and print
media — none of which this page has, so the columns here are literal JSX and the
logic is plain functions. (Eloka's array also mutates rows in place, accumulates
across fetches, and carries dead `sorting: true` flags.)

## The money rules

Ported verbatim from Eloka, and the reason `src/lib/console/transactions.ts`
exists as its own tested module:

- **Debit** = `amount_dr + fee + tds + gst + insurance_amount + eko_gst`, each
  counted only when `> 0`.
- **Credit** = `amount_cr + commission_earned + eko_service_charge + bonus`, same.
- **A failed row (`response_status_id === 1`) contributes 0 to both** — no money
  moved. Its Running Balance still renders.
- `debitOf`/`creditOf` return `0`, not `""`. Blanking an empty cell is the
  _renderer's_ job (`v || ""`); Eloka folds the blanking into its compute and
  then has to coerce numbers back out of strings everywhere downstream.

`response_status_id`: `0` success · `1` failure · `2` initiated · `3` refund
initiated · `5` hold · `8` scheduled · `9` scheduled expired. If upstream has
other failure-ish codes, the totals above are wrong — they mirror Eloka's known
semantics, no more.

**The status LABEL comes from the row's own `status` string, not from that map**
— the map only picks the Badge colour. One id spans several upstream wordings: a
real row carries `response_status_id: 5` with `status: "Payment received"`, which
the map alone would mislabel "Hold". The map's label is a fallback for when
upstream sends no string.

### Totals are per-page

Upstream returns no grand totals, so the footer sums **only the rows on screen**,
and Closing Balance is the `r_bal` of the newest row on this page under the
active filters — not the account's true closing balance. It is labelled "Totals
for this page" for exactly that reason. Real totals are an API change, not a UI
one.

## Quick search

`inferSearchField` guesses the field from the query's shape: 10 digits starting
6–9 → mobile; ≤7 → amount; 10–11 → TID; 9–18 → account. **The ranges overlap, so
the order of the checks is the spec** — a 10-digit input is both a valid mobile
and a valid TID. That's what `transactions.test.ts`'s boundary table pins.

## Request path

`POST /transactions/search` with `{ start_index, limit, filters }`.

POST, not GET, deliberately: the filters carry mobile numbers, account numbers,
TIDs and amounts. A query string would put all of them into browser history,
proxy logs, and this app's own access log (which records `path`).

The route:

1. `requireDeveloperSession` — 401 without a session, 403 for a signup/admin one.
2. `eko.getProfile(mobile)` for the caller's identity; a non-`found` profile is
   403 `NO_PROFILE`, never an empty list (an empty list reads as "you have none").
3. `parseFilters` — an allow-list mirroring `parseBusiness` in `signup.ts`. Only
   known keys are copied out, each shape-checked, so no extra interaction field
   (`org_id`, `interaction_type_id`, …) can be smuggled upstream. This is a trust
   boundary.
4. `parsePaging` — `limit` clamped to 25, `start_index` to `>= 0`.
5. `selectEvalueAccountId` on that same profile — 502 `NO_ACCOUNT` rather than
   an unfiltered call. See [§How the account is resolved](#how-the-account-is-resolved).

`hasNext = rows.length === limit`, a full-page heuristic since upstream reports no
count. On an exactly-full final page that costs one empty page.

The page fetches only when `me.state === "active"`; no other lifecycle state can
have transactions, so it shows an onboarding pointer instead of a call that could
only fail.

## Confirmed by a real response

A genuine interaction-154 response is captured verbatim in
`packages/eps-backend/src/clients/transactions.sample.ts`, and
`mapTransactionRows` is tested against it. It settles:

- **The envelope is `data.transaction_list`** — what the mapper already reads.
  Eloka's `data.data.transaction_list` has an extra layer because that's its own
  `fetcher`'s wrapper, not upstream's.
- **`tx_typeid` arrives as a string** (`"1049"`), and `status_id` mirrors
  `response_status_id`. The mapper coerces.
- **`amount_dr` / `amount_cr` are frequently absent**, not `0` — a QR Collection
  row has only `amount_cr`. The mapper defaults them, so no `NaN` reaches the UI.
- **`datetime` is ISO-8601 with a `+05:30` offset**
  (`2026-04-16T11:49:09.000+05:30`), not `YYYY-MM-DD HH:mm:ss`. It renders in the
  viewer's local zone.
- **Mobiles and accounts arrive pre-masked** (`XXXXXX1732`), so the table shows
  upstream's masking rather than doing its own.
- Fractional charges are real (`fee: 5.91`, `gst: 0.76`).
- Fields upstream sends that this page ignores: `client_ref_id`, `api_txntype`,
  `pipe`, `channel`, `customer_fee`, `ifsc`, `transaction_additional_metadata`,
  and a top-level `asofdate`.

## How the account is resolved

Interaction 154 filters by `account_id`. It comes from the caller's own
interaction-151 profile, never from the request — `getProfile` maps the
`data.account_detail` block that sits beside `user_detail`, and
`selectEvalueAccountId` (`packages/eps-backend/src/clients/accounts.ts`) picks
the E-value account from it:

1. `account_details.evalue_account_id` when it names a real account.
2. otherwise the `account_list` entry with `product_id === 1 && type_id === 1`
   (label "E-value"). Eloka reaches the same row by defaulting its account
   switcher to index 0; this page has no switcher, so it matches on the product
   rather than a position that only happens to be right.
3. otherwise the route answers **502 `NO_ACCOUNT`**.

That last step matters. Omitting `account_id` does not fail — upstream falls
back to the _default_ account (that is exactly how interaction 9 behaves), which
would quietly report somebody else's history as this user's. Refusing is the
honest answer to "we could not tell which account is yours".

**Negative ids are always filtered out.** connect-api appends a synthetic
`{ id: -500000, label: "Response Awaited Transactions" }` row to every
`account_list` it forwards (`routes/authentication.js:869`). It is a UI
pseudo-filter for Eloka's history screen, not an account, and SimpliBank never
sends it.

Both auth providers supply the same block: the direct 151 response carries
`data.account_detail`, and connect-api's login envelope carries
`account_details` (`routes/authentication.js:1075`). Neither path needs an extra
upstream call.

## Which upstream

Interaction 154 does **not** share an upstream with every other interaction: it
runs on its own host and port, on an older API version. Each part of its URL is
an optional override that falls back to the main upstream, so a deployment that
happens to share one box only has to set the path:

| Part   | History (154)                   | Everything else         | Fallback               |
| ------ | ------------------------------- | ----------------------- | ---------------------- |
| host   | `SIMPLIBANK_HISTORY_API_HOST`   | `SIMPLIBANK_API_HOST`   | main host              |
| port   | `SIMPLIBANK_HISTORY_API_PORT`   | `SIMPLIBANK_API_PORT`   | main port              |
| path   | `SIMPLIBANK_HISTORY_API_PATH`   | `SIMPLIBANK_API_PATH`   | `/ekoicici/v1/request` |
| scheme | `SIMPLIBANK_HISTORY_API_SCHEME` | `SIMPLIBANK_API_SCHEME` | main scheme            |

`config.ts` resolves these into a single `eko.historyUrl` at boot, validating it
with `new URL` and running the history host through the same plaintext-http guard
as the main one — an `http` history host that is not loopback needs
`SIMPLIBANK_ALLOW_INSECURE_HTTP=true`. `clients/eko.ts` passes that URL as the
`post()` target for 154 only; every other interaction keeps the main URL.

connect-api switches the same way in `utils/url.js:70-99`. An earlier version of
this document recorded "which server" as an open question, then answered it with
"same host, only the version segment differs" — that was wrong; the history box
is genuinely separate. Interaction 206 was also listed here; the dashboard
actually uses interaction 682 via connect-api (`src/http/dashboard.ts`), not this
path.

## Still unconfirmed

None of these block the call; each is a thing to watch on the first real UAT run.

1. **`source`.** This client sends `source: "EPS"`; Eloka sends `"WLC"` and
   connect-api defaults to `"NEWCONNECT"`. Whether upstream cares is untested.
2. **`limit` cap**, and whether `start_index` is a row offset or a page index.
3. **Filter date semantics.** `start_date`/`tx_date` are Eloka's From/To names;
   their exact upstream meaning on this transport is assumed, not confirmed.
4. **`isNetworkTransactionHistory`.** Sent as `"0"`; the network/admin statement
   view is not ported, so the non-zero case is unexercised.

### First live run

1. Sign in as a known-active UAT developer and open `/console/transactions`.
2. A **502 `NO_ACCOUNT`** means 151 returned no usable `account_detail` for that
   account — dump the raw 151 body and check the block before changing anything.
   Do not add a default.
3. Cross-check Debit / Credit / Running Balance against Eloka's History screen
   for the same user and window. The numbers must agree.
4. If the live body disagrees with `transactions.sample.ts`, update that sample
   and let its tests say what broke.
